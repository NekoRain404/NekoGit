use std::{
    fs::File,
    net::TcpStream,
    path::Path,
    process::{Child, Command, ExitStatus, Stdio},
    sync::{atomic::Ordering, Arc, Weak},
    thread,
};

use super::{
    config::{bool_env_value, inherited_env_or},
    log::{append_server_log_line, open_server_log_handles},
    paths::bundled_server_address,
    types::{DesktopServer, DesktopServerConfig},
    LOCAL_SERVER_HOST, LOCAL_SERVER_MONITOR_INTERVAL, LOCAL_SERVER_RESTART_BACKOFF,
    LOCAL_SERVER_STARTUP_ATTEMPTS, LOCAL_SERVER_STARTUP_INTERVAL,
};

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
            "NUXT_GIT_PULSE_AUTH_PERSONAL_MODE_ENABLED",
            &config.personal_mode_enabled,
        )
        .env("NUXT_GIT_PULSE_AUTH_TOKEN_ENABLED", &config.token_enabled)
        .env(
            "NUXT_GIT_PULSE_AUTH_GITHUB_OAUTH_REQUESTED",
            bool_env_value(config.oauth_requested),
        )
        .env(
            "NUXT_GIT_PULSE_AUTH_GITHUB_OAUTH_ENV_READY",
            bool_env_value(config.oauth_env_ready),
        )
        .env(
            "NUXT_GIT_PULSE_AUTH_GITHUB_OAUTH_ENABLED",
            bool_env_value(config.oauth_enabled),
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
    server_log_path: &Path,
) -> Result<(), String> {
    let address = bundled_server_address(port);
    for _ in 0..LOCAL_SERVER_STARTUP_ATTEMPTS {
        if TcpStream::connect(&address).is_ok() {
            return Ok(());
        }

        if let Ok(Some(status)) = child.try_wait() {
            return Err(format!(
                "bundled NekoGit server exited before startup completed: {status}. Server log: {}",
                server_log_path.display()
            ));
        }

        thread::sleep(LOCAL_SERVER_STARTUP_INTERVAL);
    }

    let _ = child.kill();
    let _ = child.wait();
    Err(format!(
        "timed out waiting for bundled NekoGit server to start. Server log: {}",
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
    wait_for_desktop_server_startup(&mut restarted, server.port, &server.config.server_log_path)?;
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
