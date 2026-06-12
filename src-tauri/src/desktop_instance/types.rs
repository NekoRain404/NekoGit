use std::{fs, fs::File, path::PathBuf};

use tauri::Runtime;

/// Holds the instance lock file and the activation endpoint path.
pub(crate) struct DesktopInstance {
    pub(super) _lock_file: File,
    pub(super) activation_file: PathBuf,
}

impl Drop for DesktopInstance {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.activation_file);
    }
}

/// Outcome of the instance claim attempt.
pub(crate) enum InstanceStartup {
    Primary(DesktopInstance),
    Secondary,
}

/// Callback handlers invoked when a secondary instance activates the primary.
pub(crate) struct DesktopInstanceActivationHandlers<R: Runtime> {
    pub(super) show_window: fn(&tauri::AppHandle<R>) -> Result<(), String>,
    pub(super) open_github_url: fn(&tauri::AppHandle<R>, &str) -> Result<(), String>,
}

impl<R: Runtime> Clone for DesktopInstanceActivationHandlers<R> {
    fn clone(&self) -> Self {
        *self
    }
}

impl<R: Runtime> Copy for DesktopInstanceActivationHandlers<R> {}

impl<R: Runtime> DesktopInstanceActivationHandlers<R> {
    /// Creates a new set of activation handlers from function pointers.
    pub(crate) const fn new(
        show_window: fn(&tauri::AppHandle<R>) -> Result<(), String>,
        open_github_url: fn(&tauri::AppHandle<R>, &str) -> Result<(), String>,
    ) -> Self {
        Self {
            show_window,
            open_github_url,
        }
    }
}
