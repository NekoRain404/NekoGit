//! Platform-specific file locking for the single-instance lock file.

use std::{
    fs,
    fs::{File, OpenOptions},
    path::Path,
};

#[cfg(unix)]
use std::os::fd::AsRawFd;

#[cfg(unix)]
const LOCK_EXCLUSIVE: i32 = 2;
#[cfg(unix)]
const LOCK_NONBLOCKING: i32 = 4;

#[cfg(unix)]
extern "C" {
    fn flock(fd: i32, operation: i32) -> i32;
}

#[cfg(unix)]
pub(super) fn try_lock_instance_file(path: &Path) -> Result<Option<File>, String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create instance lock directory: {error}"))?;
    }

    let file = OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(path)
        .map_err(|error| format!("failed to open NekoGit instance lock: {error}"))?;
    let status = unsafe { flock(file.as_raw_fd(), LOCK_EXCLUSIVE | LOCK_NONBLOCKING) };

    if status == 0 {
        return Ok(Some(file));
    }

    let error = std::io::Error::last_os_error();
    if error.kind() == std::io::ErrorKind::WouldBlock {
        return Ok(None);
    }

    Err(format!("failed to lock NekoGit instance file: {error}"))
}

#[cfg(not(unix))]
pub(super) fn try_lock_instance_file(path: &Path) -> Result<Option<File>, String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create instance lock directory: {error}"))?;
    }

    match OpenOptions::new()
        .read(true)
        .write(true)
        .create_new(true)
        .open(path)
    {
        Ok(file) => Ok(Some(file)),
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => Ok(None),
        Err(error) => Err(format!("failed to create NekoGit instance lock: {error}")),
    }
}
