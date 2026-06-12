use tauri::{Emitter, Runtime};

use crate::MAIN_WINDOW_LABEL;

use super::{
    names::{
        DESKTOP_CLONE_CURRENT_REPOSITORY_EVENT, DESKTOP_COMMAND_EVENT,
        DESKTOP_COPY_CURRENT_GITHUB_EVENT, DESKTOP_COPY_CURRENT_REPOSITORY_CLONE_URL_EVENT,
        DESKTOP_NAVIGATION_EVENT, DESKTOP_OPEN_CURRENT_GITHUB_EVENT,
        DESKTOP_OPEN_GITHUB_FROM_CLIPBOARD_EVENT, DESKTOP_OPEN_LOCAL_REPOSITORY_EVENT,
    },
    payloads::{
        DesktopCommandAction, DesktopCommandPayload, DesktopNavigationAction,
        DesktopNavigationPayload,
    },
};

/// Emits a navigation action (back/forward/home) to the main window.
pub(crate) fn emit_desktop_navigation<R: Runtime>(
    app: &tauri::AppHandle<R>,
    action: DesktopNavigationAction,
) -> Result<(), String> {
    app.emit_to(
        MAIN_WINDOW_LABEL,
        DESKTOP_NAVIGATION_EVENT,
        DesktopNavigationPayload { action },
    )
    .map_err(|error| format!("failed to send NekoGit navigation event: {error}"))
}

/// Emits a desktop command action (refresh, open settings, etc.) to the main window.
pub(crate) fn emit_desktop_command<R: Runtime>(
    app: &tauri::AppHandle<R>,
    action: DesktopCommandAction,
) -> Result<(), String> {
    app.emit_to(
        MAIN_WINDOW_LABEL,
        DESKTOP_COMMAND_EVENT,
        DesktopCommandPayload { action },
    )
    .map_err(|error| format!("failed to send NekoGit desktop command event: {error}"))
}

/// Requests the frontend to open the current page on GitHub.
pub(crate) fn emit_open_current_github<R: Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<(), String> {
    app.emit_to(MAIN_WINDOW_LABEL, DESKTOP_OPEN_CURRENT_GITHUB_EVENT, ())
        .map_err(|error| format!("failed to send NekoGit open-current-page event: {error}"))
}

/// Requests the frontend to open a GitHub URL from the system clipboard.
pub(crate) fn emit_open_github_from_clipboard<R: Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<(), String> {
    app.emit_to(
        MAIN_WINDOW_LABEL,
        DESKTOP_OPEN_GITHUB_FROM_CLIPBOARD_EVENT,
        (),
    )
    .map_err(|error| format!("failed to send NekoGit open-clipboard-url event: {error}"))
}

/// Requests the frontend to copy the current GitHub URL to the clipboard.
pub(crate) fn emit_copy_current_github<R: Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<(), String> {
    app.emit_to(MAIN_WINDOW_LABEL, DESKTOP_COPY_CURRENT_GITHUB_EVENT, ())
        .map_err(|error| format!("failed to send NekoGit copy-current-page event: {error}"))
}

/// Requests the frontend to copy the current repository clone URL.
pub(crate) fn emit_copy_current_repository_clone_url<R: Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<(), String> {
    app.emit_to(
        MAIN_WINDOW_LABEL,
        DESKTOP_COPY_CURRENT_REPOSITORY_CLONE_URL_EVENT,
        (),
    )
    .map_err(|error| {
        format!("failed to send NekoGit copy-current-repository-clone-url event: {error}")
    })
}

/// Requests the frontend to clone the current repository.
pub(crate) fn emit_clone_current_repository<R: Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<(), String> {
    app.emit_to(
        MAIN_WINDOW_LABEL,
        DESKTOP_CLONE_CURRENT_REPOSITORY_EVENT,
        (),
    )
    .map_err(|error| format!("failed to send NekoGit clone-current-repository event: {error}"))
}

/// Requests the frontend to open the local clone of the current repository.
pub(crate) fn emit_open_local_repository<R: Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<(), String> {
    app.emit_to(MAIN_WINDOW_LABEL, DESKTOP_OPEN_LOCAL_REPOSITORY_EVENT, ())
        .map_err(|error| format!("failed to send NekoGit open-local-repository event: {error}"))
}
