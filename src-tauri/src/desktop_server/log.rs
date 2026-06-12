//! Server log access for Desktop server management.

use std::{
    fs,
    fs::{File, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

use super::paths::default_server_log_path;

pub(super) fn open_server_log_handles(path: &Path, truncate: bool) -> Result<(File, File), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create NekoGit server log directory: {error}"))?;
    }

    let mut options = OpenOptions::new();
    options.create(true).write(true);
    if truncate {
        options.truncate(true);
    } else {
        options.append(true);
    }

    let stdout = options
        .open(path)
        .map_err(|error| format!("failed to open NekoGit server log: {error}"))?;
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

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "[nekogit-client] {message}");
    }
}

pub(super) fn open_server_log(app_data_dir: &Path) -> Result<(PathBuf, File, File), String> {
    let log_path = default_server_log_path(app_data_dir);
    let (stdout, stderr) = open_server_log_handles(&log_path, true)?;

    Ok((log_path, stdout, stderr))
}
