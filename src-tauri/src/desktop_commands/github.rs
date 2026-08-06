//! Tauri commands that open GitHub pages and profiles in the system browser.

use tauri::{AppHandle, Runtime, Url};

use crate::{
    desktop_github_cli::{
        allow_github_cli_token_read, confirm_github_cli_token_read, read_github_cli_token,
    },
    desktop_open::open_external_url,
    desktop_url::normalize_supported_github_url,
};

/// Opens the main GitHub page in the system browser.
#[tauri::command]
/// Opens the user's GitHub profile in the default browser.
pub(crate) fn desktop_open_github() -> Result<(), String> {
    open_github_url("https://github.com")
}

fn open_github_url(value: &str) -> Result<(), String> {
    let normalized = normalize_supported_github_url(value)
        .ok_or_else(|| "refusing to open unsupported GitHub URL".to_owned())?;
    let url: Url = normalized
        .parse()
        .map_err(|error| format!("failed to parse GitHub URL: {error}"))?;
    open_external_url(&url)
}

#[tauri::command]
/// Opens a specific GitHub URL in the system browser.
pub(crate) fn desktop_open_github_url(url: String) -> Result<(), String> {
    open_github_url(&url)
}

#[tauri::command]
/// Reads the current GitHub CLI authentication token after a native confirm dialog.
pub(crate) fn desktop_read_github_cli_token<R: Runtime>(
    app: AppHandle<R>,
) -> Result<String, String> {
    let confirmed = confirm_github_cli_token_read(&app)?;
    if !allow_github_cli_token_read(confirmed) {
        return Err("GitHub CLI token access was denied".to_owned());
    }
    read_github_cli_token()
}
