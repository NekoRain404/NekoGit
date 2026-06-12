use tauri::{webview::NewWindowResponse, Manager, Runtime, Url};

use crate::{
    desktop_open::{is_external_browser_url, is_same_origin, open_external_url},
    desktop_runtime::DesktopRuntime,
    desktop_url::{dashboard_url_for_github_launch, is_nekogit_dashboard_github_target_url},
};

use super::{constants::MAIN_WINDOW_LABEL, visibility::show_main_window};

pub(crate) fn open_github_launch_url<R: Runtime>(
    app: &tauri::AppHandle<R>,
    target_url: &str,
) -> Result<(), String> {
    let runtime = app
        .try_state::<DesktopRuntime>()
        .ok_or_else(|| "desktop runtime is not ready yet".to_owned())?;
    let navigation_url = dashboard_url_for_github_launch(&runtime.client_url, target_url)?;

    show_main_window(app)?;

    let window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "NekoGit window is not ready yet".to_owned())?;
    window
        .navigate(navigation_url)
        .map_err(|error| format!("failed to navigate NekoGit window: {error}"))
}

fn navigate_to_dashboard_github_target<R: Runtime>(
    app: &tauri::AppHandle<R>,
    client_url: &str,
    target_url: &str,
) -> Result<(), String> {
    let navigation_url = dashboard_url_for_github_launch(client_url, target_url)?;
    let window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "NekoGit window is not ready yet".to_owned())?;

    window
        .navigate(navigation_url)
        .map_err(|error| format!("failed to navigate NekoGit window: {error}"))
}

pub(crate) fn handle_navigation<R: Runtime>(
    app: &tauri::AppHandle<R>,
    client_origin: &Url,
    url: &Url,
) -> bool {
    if is_same_origin(client_origin, url) {
        return true;
    }

    if is_nekogit_dashboard_github_target_url(url) {
        if let Err(error) =
            navigate_to_dashboard_github_target(app, client_origin.as_str(), url.as_str())
        {
            eprintln!("{error}");
        }
        return false;
    }

    if is_external_browser_url(url) {
        if let Err(error) = open_external_url(url) {
            eprintln!("{error}");
        }
    }

    false
}

pub(crate) fn handle_new_window_navigation<R: Runtime>(
    app: &tauri::AppHandle<R>,
    client_origin: &Url,
    url: &Url,
) -> NewWindowResponse<R> {
    if is_same_origin(client_origin, url) {
        if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
            if let Err(error) = window.navigate(url.clone()) {
                eprintln!("failed to navigate NekoGit window: {error}");
            }
        }
        return NewWindowResponse::Deny;
    }

    if is_nekogit_dashboard_github_target_url(url) {
        if let Err(error) =
            navigate_to_dashboard_github_target(app, client_origin.as_str(), url.as_str())
        {
            eprintln!("{error}");
        }
        return NewWindowResponse::Deny;
    }

    if is_external_browser_url(url) {
        if let Err(error) = open_external_url(url) {
            eprintln!("{error}");
        }
    }

    NewWindowResponse::Deny
}
