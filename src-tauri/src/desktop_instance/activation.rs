use std::{
    fs,
    io::{Read, Write},
    net::{Shutdown, TcpListener, TcpStream},
    path::Path,
    thread,
    time::Duration,
};

use tauri::Runtime;

use crate::desktop_url::{activation_message, parse_activation_request, ActivationRequest};

use super::types::DesktopInstanceActivationHandlers;

const LOCAL_SERVER_HOST: &str = "127.0.0.1";
const INSTANCE_ACTIVATION_ATTEMPTS: usize = 50;
const INSTANCE_ACTIVATION_INTERVAL: Duration = Duration::from_millis(100);

fn parse_instance_port(value: &str) -> Option<u16> {
    value.trim().parse::<u16>().ok().filter(|port| *port > 0)
}

fn open_github_launch_url_with_retry<R: Runtime>(
    app: &tauri::AppHandle<R>,
    target_url: &str,
    handlers: DesktopInstanceActivationHandlers<R>,
) -> Result<(), String> {
    let mut last_error = None;

    for _ in 0..INSTANCE_ACTIVATION_ATTEMPTS {
        match (handlers.open_github_url)(app, target_url) {
            Ok(()) => return Ok(()),
            Err(error) => {
                last_error = Some(error);
                thread::sleep(INSTANCE_ACTIVATION_INTERVAL);
            }
        }
    }

    Err(last_error.unwrap_or_else(|| "failed to open GitHub URL in NekoGit".to_owned()))
}

/// Sends a show/open message to the already-running instance over TCP.
pub(super) fn notify_existing_instance(
    activation_file: &Path,
    target_url: Option<&str>,
) -> Result<(), String> {
    let message = activation_message(target_url);

    for _ in 0..INSTANCE_ACTIVATION_ATTEMPTS {
        if let Ok(value) = fs::read_to_string(activation_file) {
            if let Some(port) = parse_instance_port(&value) {
                if let Ok(mut stream) = TcpStream::connect((LOCAL_SERVER_HOST, port)) {
                    stream
                        .write_all(message.as_bytes())
                        .map_err(|error| format!("failed to notify NekoGit instance: {error}"))?;
                    let _ = stream.shutdown(Shutdown::Write);
                    return Ok(());
                }
            }
        }

        thread::sleep(INSTANCE_ACTIVATION_INTERVAL);
    }

    Err(
        "another NekoGit instance is running, but its activation endpoint was not reachable"
            .to_owned(),
    )
}

/// Starts a TCP listener thread that accepts activation requests from secondary instances.
pub(super) fn start_instance_activation_listener<R: Runtime + 'static>(
    app: &tauri::App<R>,
    activation_file: &Path,
    handlers: DesktopInstanceActivationHandlers<R>,
) -> Result<(), String> {
    let listener = TcpListener::bind((LOCAL_SERVER_HOST, 0))
        .map_err(|error| format!("failed to bind NekoGit activation listener: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("failed to read NekoGit activation listener port: {error}"))?
        .port();

    fs::write(activation_file, format!("{port}\n"))
        .map_err(|error| format!("failed to write NekoGit activation file: {error}"))?;

    let app_handle = app.handle().clone();
    thread::Builder::new()
        .name("nekogit-instance-activation".to_owned())
        .spawn(move || {
            for connection in listener.incoming() {
                match connection {
                    Ok(mut stream) => {
                        let mut message = String::new();
                        let request = stream
                            .read_to_string(&mut message)
                            .map(|_| parse_activation_request(&message))
                            .unwrap_or(ActivationRequest::Show);

                        match request {
                            ActivationRequest::Show => {
                                if let Err(error) = (handlers.show_window)(&app_handle) {
                                    eprintln!("{error}");
                                }
                            }
                            ActivationRequest::OpenGithubUrl(target_url) => {
                                if let Err(error) = open_github_launch_url_with_retry(
                                    &app_handle,
                                    &target_url,
                                    handlers,
                                ) {
                                    eprintln!("{error}");
                                }
                            }
                        }

                        if let Err(error) = stream.write_all(b"ok\n") {
                            if error.kind() != std::io::ErrorKind::BrokenPipe {
                                eprintln!("{error}");
                            }
                        }
                    }
                    Err(error) => {
                        eprintln!("NekoGit activation listener stopped: {error}");
                        break;
                    }
                }
            }
        })
        .map(|_| ())
        .map_err(|error| format!("failed to start NekoGit activation listener: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_valid_instance_ports() {
        assert_eq!(parse_instance_port("43021\n"), Some(43021));
        assert_eq!(parse_instance_port("  1  "), Some(1));
    }

    #[test]
    fn rejects_invalid_instance_ports() {
        assert_eq!(parse_instance_port("0"), None);
        assert_eq!(parse_instance_port("65536"), None);
        assert_eq!(parse_instance_port("not-a-port"), None);
    }
}
