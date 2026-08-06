//! Desktop autostart integration: enables, disables, and reports whether NekoGit launches with the system.

use std::{
    env, fs,
    path::{Path, PathBuf},
};

use serde::Serialize;

pub(crate) const START_HIDDEN_ARG: &str = "--start-hidden";

const AUTOSTART_DESKTOP_FILE: &str = "NekoGit.desktop";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
/// Current status of the desktop autostart integration.
pub(crate) struct DesktopAutostartStatus {
    pub(crate) supported: bool,
    pub(crate) enabled: bool,
    pub(crate) path: Option<String>,
}

fn path_to_display_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn home_dir() -> Option<PathBuf> {
    env::var_os("HOME")
        .map(PathBuf::from)
        .filter(|path| !path.as_os_str().is_empty())
}

fn user_config_dir() -> Option<PathBuf> {
    env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .filter(|path| !path.as_os_str().is_empty())
        .or_else(|| home_dir().map(|path| path.join(".config")))
}

fn desktop_autostart_file_path() -> Option<PathBuf> {
    user_config_dir().map(|path| path.join("autostart").join(AUTOSTART_DESKTOP_FILE))
}

fn escape_desktop_exec_path(value: &Path) -> String {
    let value = value.to_string_lossy();

    if value
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '/' | '.' | '_' | '-' | '+'))
    {
        return value.into_owned();
    }

    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}

fn desktop_autostart_entry(executable: &Path) -> String {
    format!(
        concat!(
            "[Desktop Entry]\n",
            "Type=Application\n",
            "Name=NekoGit\n",
            "Comment=GitHub notifications, issues, pull requests, and repositories\n",
            "Exec={} {}\n",
            "Terminal=false\n",
            "X-GNOME-Autostart-enabled=true\n"
        ),
        escape_desktop_exec_path(executable),
        START_HIDDEN_ARG
    )
}

fn desktop_autostart_status_from_path(path: Option<PathBuf>) -> DesktopAutostartStatus {
    DesktopAutostartStatus {
        supported: path.is_some(),
        enabled: path.as_ref().is_some_and(|path| path.is_file()),
        path: path.as_deref().map(path_to_display_string),
    }
}

/// Returns the current autostart configuration for the desktop environment.
pub(crate) fn read_desktop_autostart_status() -> DesktopAutostartStatus {
    desktop_autostart_status_from_path(desktop_autostart_file_path())
}

/// Enables or disables autostart by creating/removing the `.desktop` entry file.
pub(crate) fn set_desktop_autostart_enabled(
    enabled: bool,
) -> Result<DesktopAutostartStatus, String> {
    let Some(path) = desktop_autostart_file_path() else {
        return Ok(desktop_autostart_status_from_path(None));
    };

    if enabled {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!("failed to create NekoGit autostart directory: {error}")
            })?;
        }

        let executable = env::current_exe()
            .map_err(|error| format!("failed to resolve NekoGit executable path: {error}"))?;
        fs::write(&path, desktop_autostart_entry(&executable))
            .map_err(|error| format!("failed to write NekoGit autostart entry: {error}"))?;
    } else if path.exists() {
        fs::remove_file(&path)
            .map_err(|error| format!("failed to remove NekoGit autostart entry: {error}"))?;
    }

    Ok(desktop_autostart_status_from_path(Some(path)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_desktop_autostart_status_from_entry_path() {
        let missing_path =
            env::temp_dir().join(format!("nekogit-missing-autostart-{}", std::process::id()));
        let missing = desktop_autostart_status_from_path(Some(missing_path.clone()));
        assert!(missing.supported);
        assert!(!missing.enabled);
        assert_eq!(missing.path, Some(path_to_display_string(&missing_path)));

        let unsupported = desktop_autostart_status_from_path(None);
        assert!(!unsupported.supported);
        assert!(!unsupported.enabled);
        assert_eq!(unsupported.path, None);
    }

    #[test]
    fn builds_desktop_autostart_entry_with_hidden_launch_arg() {
        let entry = desktop_autostart_entry(Path::new("/opt/NekoGit/nekogit-client"));

        assert!(entry.contains("Type=Application"));
        assert!(entry.contains("Name=NekoGit"));
        assert!(entry.contains("Exec=/opt/NekoGit/nekogit-client --start-hidden"));
        assert!(entry.contains("X-GNOME-Autostart-enabled=true"));
    }

    #[test]
    fn escapes_desktop_autostart_exec_paths_when_needed() {
        let entry = desktop_autostart_entry(Path::new("/opt/Git Pulse/nekogit-client"));

        assert!(entry.contains("Exec=\"/opt/Git Pulse/nekogit-client\" --start-hidden"));
    }
}
