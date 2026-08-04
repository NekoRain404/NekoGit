//! Server process management for Desktop server management.

use std::{
    fs::File,
    io::{Read, Write},
    net::TcpStream,
    path::Path,
    process::{Child, Command, ExitStatus, Stdio},
    sync::{atomic::Ordering, Arc, Weak},
    thread,
    time::Duration,
};

use hmac::{Hmac, Mac};
use sha2::Sha256;

use super::{
    config::{bool_env_value, inherited_env_or},
    log::{append_server_log_line, open_server_log_handles},
    paths::bundled_server_address,
    types::{DesktopServer, DesktopServerConfig},
    LOCAL_SERVER_HOST, LOCAL_SERVER_MONITOR_INTERVAL, LOCAL_SERVER_RESTART_BACKOFF,
    LOCAL_SERVER_STARTUP_ATTEMPTS, LOCAL_SERVER_STARTUP_INTERVAL,
};

type HmacSha256 = Hmac<Sha256>;

const READINESS_ENV: &str = "NEKOGIT_DESKTOP_READINESS_TOKEN";
const READINESS_PATH: &str = "/__nekogit/health";
const READINESS_PROOF_DOMAIN: &str = "nekogit-desktop-readiness-v1|";

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push(HEX[(byte >> 4) as usize] as char);
        out.push(HEX[(byte & 0xf) as usize] as char);
    }
    out
}

/// Generate a public challenge for the readiness probe (never the shared secret).
pub(super) fn generate_readiness_challenge() -> Result<String, String> {
    let mut bytes = [0u8; 16];
    getrandom::fill(&mut bytes)
        .map_err(|error| format!("failed to generate readiness challenge: {error}"))?;
    Ok(hex_encode(&bytes))
}

/// HMAC-SHA256 proof matching `shared/utils/desktop-readiness.ts`.
pub(super) fn build_desktop_readiness_proof(token: &str, challenge: &str) -> String {
    let mut mac = HmacSha256::new_from_slice(token.as_bytes())
        .expect("HMAC accepts keys of any size");
    mac.update(READINESS_PROOF_DOMAIN.as_bytes());
    mac.update(challenge.as_bytes());
    hex_encode(&mac.finalize().into_bytes())
}

/// Build the raw HTTP readiness request (challenge only; secret never sent).
pub(super) fn build_readiness_http_request(host_header: &str, challenge: &str) -> String {
    format!(
        "GET {READINESS_PATH}?challenge={challenge} HTTP/1.1\r\nHost: {host_header}\r\nConnection: close\r\n\r\n"
    )
}

/// Return true when an HTTP response starts with a successful status line.
pub(super) fn is_successful_http_status_line(response: &str) -> bool {
    let status_line = response.lines().next().unwrap_or("").trim();
    status_line.starts_with("HTTP/1.0 200")
        || status_line.starts_with("HTTP/1.1 200")
        || status_line.starts_with("HTTP/2 200")
}

/// Extract JSON body after HTTP headers.
pub(super) fn http_response_body(response: &str) -> &str {
    if let Some(index) = response.find("\r\n\r\n") {
        return &response[index + 4..];
    }
    if let Some(index) = response.find("\n\n") {
        return &response[index + 2..];
    }
    ""
}

/// True when the response is HTTP 200 and the body proof matches the shared secret.
pub(super) fn is_valid_readiness_response(
    response: &str,
    readiness_token: &str,
    challenge: &str,
) -> bool {
    if !is_successful_http_status_line(response) {
        return false;
    }

    let expected_proof = build_desktop_readiness_proof(readiness_token, challenge);
    let body = http_response_body(response).trim();
    let Ok(value) = serde_json::from_str::<serde_json::Value>(body) else {
        return false;
    };

    let Some(proof) = value.get("proof").and_then(|v| v.as_str()) else {
        return false;
    };
    let service_ok = value
        .get("service")
        .and_then(|v| v.as_str())
        .is_some_and(|service| service == "nekogit-desktop");
    let ok_flag = value.get("ok").and_then(|v| v.as_bool()).unwrap_or(false);

    ok_flag && service_ok && proof == expected_proof
}

/// Probe the bundled server readiness endpoint with challenge-response HMAC.
pub(super) fn probe_desktop_server_readiness(port: u16, readiness_token: &str) -> bool {
    let Ok(challenge) = generate_readiness_challenge() else {
        return false;
    };
    let address = bundled_server_address(port);
    let Ok(mut stream) = TcpStream::connect(&address) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));

    let request = build_readiness_http_request(&address, &challenge);
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let _ = stream.flush();

    let mut response = String::new();
    let _ = stream.read_to_string(&mut response);
    is_valid_readiness_response(&response, readiness_token, &challenge)
}

fn build_desktop_server_command(
    config: &DesktopServerConfig,
    port: u16,
    server_stdout: File,
    server_stderr: File,
) -> Command {
    let mut command = Command::new(&config.node_binary);
    command
        .arg(&config.server_entry)
        .current_dir(&config.server_dir)
        .env("NODE_ENV", inherited_env_or("NODE_ENV", "production"))
        .env("HOST", LOCAL_SERVER_HOST)
        .env("PORT", port.to_string())
        .env("NITRO_HOST", LOCAL_SERVER_HOST)
        .env("NITRO_PORT", port.to_string())
        .env("NUXT_SESSION_PASSWORD", &config.session_password)
        .env("NUXT_NEKOGIT_AUTH_SESSION_COOKIE_SECURE", "false")
        .env(READINESS_ENV, &config.readiness_token)
        .env(
            "NUXT_AUTH_PERSONAL_MODE_ENABLED",
            &config.personal_mode_enabled,
        )
        .env("NUXT_AUTH_PAT_ENABLED", &config.token_enabled)
        .env(
            "NUXT_AUTH_GITHUB_OAUTH_ENABLED",
            bool_env_value(config.oauth_requested),
        )
        .env(
            "NUXT_NEKOGIT_USER_SETTINGS_STORAGE_DRIVER",
            &config.user_settings_storage_driver,
        )
        .env(
            "NUXT_NEKOGIT_USER_SETTINGS_STORAGE_BASE",
            &config.user_settings_storage_base,
        )
        .stdin(Stdio::null())
        .stdout(Stdio::from(server_stdout))
        .stderr(Stdio::from(server_stderr));

    // Ensure host proxy env is visible to the bundled Nitro process (login + env fallback).
    for name in [
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "ALL_PROXY",
        "NO_PROXY",
        "http_proxy",
        "https_proxy",
        "all_proxy",
        "no_proxy",
    ] {
        if let Ok(value) = std::env::var(name) {
            if !value.trim().is_empty() {
                command.env(name, value);
            }
        }
    }

    command
}

pub(super) fn spawn_desktop_server_child(
    config: &DesktopServerConfig,
    port: u16,
    truncate_log: bool,
) -> Result<Child, String> {
    let (server_stdout, server_stderr) =
        open_server_log_handles(&config.server_log_path, truncate_log)?;
    build_desktop_server_command(config, port, server_stdout, server_stderr)
        .spawn()
        .map_err(|error| {
            format!(
                "failed to start bundled NekoGit server with `{}`. Rebuild the desktop package or set NEKOGIT_NODE_PATH: {error}",
                config.node_binary.display()
            )
        })
}

pub(super) fn wait_for_desktop_server_startup(
    child: &mut Child,
    port: u16,
    readiness_token: &str,
    server_log_path: &Path,
) -> Result<(), String> {
    for _ in 0..LOCAL_SERVER_STARTUP_ATTEMPTS {
        if let Ok(Some(status)) = child.try_wait() {
            return Err(format!(
                "bundled NekoGit server exited before startup completed: {status}. Server log: {}",
                server_log_path.display()
            ));
        }

        // Require the child to still be alive and answer the app-specific readiness probe.
        // A bare TCP connect is not enough (port TOCTOU / hostile local listeners).
        if probe_desktop_server_readiness(port, readiness_token) {
            if let Ok(Some(status)) = child.try_wait() {
                return Err(format!(
                    "bundled NekoGit server exited after readiness probe: {status}. Server log: {}",
                    server_log_path.display()
                ));
            }
            return Ok(());
        }

        thread::sleep(LOCAL_SERVER_STARTUP_INTERVAL);
    }

    let _ = child.kill();
    let _ = child.wait();
    Err(format!(
        "timed out waiting for bundled NekoGit server readiness probe. Server log: {}",
        server_log_path.display()
    ))
}

pub(super) fn restart_desktop_server_child(server: &DesktopServer) -> Result<(), String> {
    let mut child = server
        .child
        .lock()
        .map_err(|_| "failed to lock bundled NekoGit server process".to_owned())?;
    let _ = child.kill();
    let _ = child.wait();

    append_server_log_line(
        &server.config.server_log_path,
        "restarting bundled NekoGit server",
    );
    let mut restarted = spawn_desktop_server_child(&server.config, server.port, false)?;
    wait_for_desktop_server_startup(
        &mut restarted,
        server.port,
        &server.config.readiness_token,
        &server.config.server_log_path,
    )?;
    *child = restarted;

    Ok(())
}

fn handle_desktop_server_exit(server: &DesktopServer, status: ExitStatus) -> Result<(), String> {
    if let Ok(mut last_exit_status) = server.last_exit_status.lock() {
        *last_exit_status = Some(status.to_string());
    }

    append_server_log_line(
        &server.config.server_log_path,
        &format!("bundled NekoGit server exited with {status}; restarting"),
    );
    thread::sleep(LOCAL_SERVER_RESTART_BACKOFF);
    restart_desktop_server_child(server)
}

pub(super) fn start_desktop_server_monitor(server: &Arc<DesktopServer>) -> Result<(), String> {
    let weak_server: Weak<DesktopServer> = Arc::downgrade(server);
    thread::Builder::new()
        .name("nekogit-server-monitor".to_owned())
        .spawn(move || loop {
            thread::sleep(LOCAL_SERVER_MONITOR_INTERVAL);

            let Some(server) = weak_server.upgrade() else {
                break;
            };
            if server.shutting_down.load(Ordering::SeqCst) {
                break;
            }

            let exit_status = {
                let mut child = match server.child.lock() {
                    Ok(child) => child,
                    Err(_) => {
                        append_server_log_line(
                            &server.config.server_log_path,
                            "failed to lock bundled NekoGit server process for monitoring",
                        );
                        break;
                    }
                };

                match child.try_wait() {
                    Ok(Some(status)) => Some(status),
                    Ok(None) => None,
                    Err(error) => {
                        append_server_log_line(
                            &server.config.server_log_path,
                            &format!("failed to inspect bundled NekoGit server: {error}"),
                        );
                        None
                    }
                }
            };

            if let Some(status) = exit_status {
                if let Err(error) = handle_desktop_server_exit(&server, status) {
                    append_server_log_line(&server.config.server_log_path, &error);
                }
            }
        })
        .map(|_| ())
        .map_err(|error| format!("failed to start NekoGit server monitor: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_readiness_request_with_challenge_not_secret() {
        let request = build_readiness_http_request("127.0.0.1:43210", "aabbccddeeff0011");
        assert!(request.starts_with("GET /__nekogit/health?challenge=aabbccddeeff0011 HTTP/1.1\r\n"));
        assert!(request.contains("Host: 127.0.0.1:43210\r\n"));
        assert!(!request.to_ascii_lowercase().contains("deadbeef"));
        assert!(!request.contains("x-nekogit-readiness"));
    }

    #[test]
    fn accepts_only_http_200_status_lines() {
        assert!(is_successful_http_status_line("HTTP/1.1 200 OK\r\n\r\n"));
        assert!(is_successful_http_status_line("HTTP/1.0 200 OK\n"));
        assert!(!is_successful_http_status_line("HTTP/1.1 404 Not Found\r\n\r\n"));
        assert!(!is_successful_http_status_line("HTTP/1.1 401 Unauthorized\r\n\r\n"));
        assert!(!is_successful_http_status_line(""));
    }

    #[test]
    fn readiness_response_requires_matching_hmac_proof() {
        let token = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        let challenge = "aabbccddeeff00112233445566778899";
        let proof = build_desktop_readiness_proof(token, challenge);
        let good = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{{\"ok\":true,\"service\":\"nekogit-desktop\",\"proof\":\"{proof}\"}}"
        );
        assert!(is_valid_readiness_response(&good, token, challenge));

        let forged_200 = "HTTP/1.1 200 OK\r\n\r\n{\"ok\":true,\"service\":\"nekogit-desktop\",\"proof\":\"00\"}";
        assert!(!is_valid_readiness_response(forged_200, token, challenge));

        let wrong_service = format!(
            "HTTP/1.1 200 OK\r\n\r\n{{\"ok\":true,\"service\":\"other\",\"proof\":\"{proof}\"}}"
        );
        assert!(!is_valid_readiness_response(&wrong_service, token, challenge));

        let status_only_200 = "HTTP/1.1 200 OK\r\n\r\n";
        assert!(!is_valid_readiness_response(status_only_200, token, challenge));
    }
}
