//! Server log access for Desktop server management.

use std::{
    fs,
    fs::{File, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

#[cfg(unix)]
use std::os::unix::fs::OpenOptionsExt;

use super::paths::default_server_log_path;

/// Build options for opening the server log, restricting new Unix files to the owner.
fn server_log_open_options(truncate: bool) -> OpenOptions {
    let mut options = OpenOptions::new();
    options.create(true).write(true);
    if truncate {
        options.truncate(true);
    } else {
        options.append(true);
    }

    // Creation mode is only applied when the file does not exist yet.
    #[cfg(unix)]
    {
        options.mode(0o600);
    }

    options
}

/// Ensure an existing log file is also owner-only, not just newly created ones.
#[cfg(unix)]
fn restrict_server_log_permissions(file: &File) {
    use std::os::unix::fs::PermissionsExt;

    let _ = file.set_permissions(fs::Permissions::from_mode(0o600));
}

#[cfg(not(unix))]
fn restrict_server_log_permissions(_file: &File) {}

pub(super) fn open_server_log_handles(path: &Path, truncate: bool) -> Result<(File, File), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create NekoGit server log directory: {error}"))?;
    }

    let stdout = server_log_open_options(truncate)
        .open(path)
        .map_err(|error| format!("failed to open NekoGit server log: {error}"))?;
    restrict_server_log_permissions(&stdout);

    let stderr = stdout
        .try_clone()
        .map_err(|error| format!("failed to clone NekoGit server log handle: {error}"))?;

    Ok((stdout, stderr))
}

pub(super) fn append_server_log_line(path: &Path, message: &str) {
    if let Some(parent) = path.parent() {
        if fs::create_dir_all(parent).is_err() {
            return;
        }
    }

    if let Ok(mut file) = server_log_open_options(false).open(path) {
        restrict_server_log_permissions(&file);
        let _ = writeln!(file, "[nekogit-client] {message}");
    }
}

pub(super) fn open_server_log(app_data_dir: &Path) -> Result<(PathBuf, File, File), String> {
    let log_path = default_server_log_path(app_data_dir);
    let (stdout, stderr) = open_server_log_handles(&log_path, true)?;

    Ok((log_path, stdout, stderr))
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt;

    fn temp_log_path(name: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir()
            .join(format!(
                "nekogit-server-log-test-{name}-{}-{nanos}",
                std::process::id()
            ))
            .join("server.log")
    }

    fn file_mode(path: &Path) -> u32 {
        fs::metadata(path).unwrap().permissions().mode() & 0o777
    }

    #[test]
    fn creates_server_log_with_owner_only_permissions() {
        let path = temp_log_path("create");
        let (stdout, stderr) = open_server_log_handles(&path, true).unwrap();
        drop(stdout);
        drop(stderr);

        assert_eq!(file_mode(&path), 0o600);

        let _ = fs::remove_dir_all(path.parent().unwrap());
    }

    #[test]
    fn append_fallback_creates_and_tightens_server_log_permissions() {
        let path = temp_log_path("append");
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, "").unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();

        append_server_log_line(&path, "hello from test");

        assert_eq!(file_mode(&path), 0o600);
        assert!(fs::read_to_string(&path)
            .unwrap()
            .contains("hello from test"));

        let _ = fs::remove_dir_all(path.parent().unwrap());
    }
}
