//! Tauri commands that drive window, tray, and menu state from the frontend.

use tauri::{Runtime, State};

use crate::{
    desktop_menu::{
        apply_desktop_current_github_state, apply_desktop_navigation_state,
        apply_desktop_notification_menu_state, apply_desktop_review_state,
        DesktopCurrentGitHubMenu, DesktopCurrentGitHubState, DesktopNavigationMenu,
        DesktopNavigationState, DesktopNotificationMenu, DesktopReviewMenu, DesktopReviewState,
    },
    desktop_server::restart_bundled_desktop_server,
    desktop_tray::update_desktop_unread_count,
    desktop_window::{show_main_window, update_desktop_window_title, MAIN_WINDOW_LABEL},
};

#[tauri::command]
/// Updates the unread notification badge on the window and tray icon.
pub(crate) fn desktop_set_unread_count<R: Runtime>(
    app: tauri::AppHandle<R>,
    menu: State<'_, DesktopNotificationMenu<R>>,
    count: u32,
) -> Result<(), String> {
    let count = update_desktop_unread_count(&app, MAIN_WINDOW_LABEL, count)?;
    apply_desktop_notification_menu_state(menu.inner(), count)
}

#[tauri::command]
/// Updates the main window title from the frontend.
pub(crate) fn desktop_set_window_title<R: Runtime>(
    app: tauri::AppHandle<R>,
    title: String,
) -> Result<(), String> {
    update_desktop_window_title(&app, &title)
}

#[tauri::command]
/// Synchronizes the Navigate menu enabled/disabled state with the frontend.
pub(crate) fn desktop_set_navigation_state<R: Runtime>(
    _app: tauri::AppHandle<R>,
    menu: State<'_, DesktopNavigationMenu<R>>,
    state: DesktopNavigationState,
) -> Result<(), String> {
    apply_desktop_navigation_state(menu.inner(), state)
}

#[tauri::command]
/// Synchronizes the Review menu enabled/disabled state with the frontend.
pub(crate) fn desktop_set_review_state<R: Runtime>(
    _app: tauri::AppHandle<R>,
    menu: State<'_, DesktopReviewMenu<R>>,
    state: DesktopReviewState,
) -> Result<(), String> {
    apply_desktop_review_state(menu.inner(), state)
}

#[tauri::command]
/// Synchronizes the GitHub context menu state with the frontend.
pub(crate) fn desktop_set_current_github_state<R: Runtime>(
    _app: tauri::AppHandle<R>,
    menu: State<'_, DesktopCurrentGitHubMenu<R>>,
    state: DesktopCurrentGitHubState,
) -> Result<(), String> {
    apply_desktop_current_github_state(menu.inner(), state)
}

#[tauri::command]
/// Brings the main window to the foreground and gives it focus.
pub(crate) fn desktop_show_window<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    show_main_window(&app)
}

#[tauri::command]
/// Restarts the bundled Nuxt/Nitro server process.
pub(crate) fn desktop_restart_bundled_server<R: Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<(), String> {
    restart_bundled_desktop_server(&app)
}
