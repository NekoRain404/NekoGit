use std::{
    path::Path,
    process::{Command, Stdio},
};

use tauri::Url;

/// Returns `true` when two URLs share the same scheme, host, and port.
pub(crate) fn is_same_origin(left: &Url, right: &Url) -> bool {
    left.scheme() == right.scheme()
        && left.host_str() == right.host_str()
        && left.port_or_known_default() == right.port_or_known_default()
}

/// Returns `true` if the URL uses an HTTP(S) scheme suitable for an external browser.
pub(crate) fn is_external_browser_url(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https")
}

/// Opens the given URL in the system default browser.
pub(crate) fn open_external_url(url: &Url) -> Result<(), String> {
    if !is_external_browser_url(url) {
        return Err(format!(
            "refusing to open unsupported external URL scheme: {}",
            url.scheme()
        ));
    }

    let mut command = if cfg!(target_os = "windows") {
        let mut command = Command::new("rundll32");
        command.arg("url.dll,FileProtocolHandler").arg(url.as_str());
        command
    } else if cfg!(target_os = "macos") {
        let mut command = Command::new("open");
        command.arg(url.as_str());
        command
    } else {
        let mut command = Command::new("xdg-open");
        command.arg(url.as_str());
        command
    };

    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("failed to open external URL `{url}`: {error}"))
}

/// Opens the given filesystem path with the platform-native file manager.
pub(crate) fn open_path(path: &Path) -> Result<(), String> {
    let mut command = if cfg!(target_os = "windows") {
        Command::new("explorer")
    } else if cfg!(target_os = "macos") {
        Command::new("open")
    } else {
        Command::new("xdg-open")
    };

    command
        .arg(path)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("failed to open `{}`: {error}", path.display()))
}

fn spawn_terminal_command(mut command: Command) -> Result<(), String> {
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

/// Opens a terminal emulator at the given directory, trying several known candidates on Linux.
pub(crate) fn open_terminal_at_path(path: &Path) -> Result<(), String> {
    if !path.is_dir() {
        return Err(format!(
            "terminal path is not a directory: {}",
            path.display()
        ));
    }

    if cfg!(target_os = "windows") {
        let mut command = Command::new("cmd");
        command.arg("/C").arg("start").arg("").arg("cmd").arg("/K");
        command.current_dir(path);
        return spawn_terminal_command(command)
            .map_err(|error| format!("failed to open terminal at `{}`: {error}", path.display()));
    }

    if cfg!(target_os = "macos") {
        let mut command = Command::new("open");
        command.arg("-a").arg("Terminal").arg(path);
        return spawn_terminal_command(command)
            .map_err(|error| format!("failed to open terminal at `{}`: {error}", path.display()));
    }

    let candidates: &[(&str, &[&str])] = &[
        ("x-terminal-emulator", &[]),
        ("gnome-terminal", &[]),
        ("konsole", &[]),
        ("xfce4-terminal", &[]),
        ("mate-terminal", &[]),
        ("alacritty", &[]),
        ("kitty", &[]),
        ("wezterm", &["start", "--cwd", "."]),
        ("xterm", &[]),
    ];
    let mut errors = Vec::new();

    for (program, args) in candidates {
        let mut command = Command::new(program);
        command.args(*args).current_dir(path);
        match spawn_terminal_command(command) {
            Ok(()) => return Ok(()),
            Err(error) => errors.push(format!("{program}: {error}")),
        }
    }

    Err(format!(
        "failed to open terminal at `{}`: {}",
        path.display(),
        errors.join("; ")
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn treats_same_scheme_host_and_port_as_same_origin() {
        let left: Url = "http://127.0.0.1:3000/dashboard".parse().unwrap();
        let right: Url = "http://127.0.0.1:3000/api/user".parse().unwrap();

        assert!(is_same_origin(&left, &right));
    }

    #[test]
    fn treats_different_ports_as_different_origins() {
        let left: Url = "http://127.0.0.1:3000/dashboard".parse().unwrap();
        let right: Url = "http://127.0.0.1:3001/dashboard".parse().unwrap();

        assert!(!is_same_origin(&left, &right));
    }

    #[test]
    fn recognizes_only_http_urls_as_external_browser_targets() {
        let github: Url = "https://github.com/owner/repo".parse().unwrap();
        let local: Url = "http://127.0.0.1:3000/dashboard".parse().unwrap();
        let mailto: Url = "mailto:hello@example.com".parse().unwrap();

        assert!(is_external_browser_url(&github));
        assert!(is_external_browser_url(&local));
        assert!(!is_external_browser_url(&mailto));
    }
}
