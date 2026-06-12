//! Window show/hide logic for Window management.

use tauri::{Manager, Runtime};

use super::constants::MAIN_WINDOW_LABEL;

/// Shows the resource.
pub(crate) fn show_main_window<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        window
            .show()
            .map_err(|error| format!("failed to show NekoGit window: {error}"))?;
        window
            .unminimize()
            .map_err(|error| format!("failed to unminimize NekoGit window: {error}"))?;
        window
            .set_focus()
            .map_err(|error| format!("failed to focus NekoGit window: {error}"))?;
    }

    Ok(())
}

/// Hides the resource.
pub(crate) fn hide_main_window<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        window
            .hide()
            .map_err(|error| format!("failed to hide NekoGit window: {error}"))?;
    }

    Ok(())
}
