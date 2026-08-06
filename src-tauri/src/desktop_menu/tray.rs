//! Builds the system tray context menu with notification items for state updates.

use tauri::{
    menu::{MenuBuilder, MenuItem},
    Manager, Runtime,
};

use super::ids::*;

/// Builds the system tray context menu and returns the notification menu items for state updates.
pub(crate) fn build_tray_menu<R: Runtime, M: Manager<R>>(
    manager: &M,
) -> tauri::Result<(tauri::menu::Menu<R>, MenuItem<R>, MenuItem<R>)> {
    let show_window =
        MenuItem::with_id(manager, MENU_SHOW_WINDOW, "Show Window", true, None::<&str>)?;
    let quick_open = MenuItem::with_id(manager, MENU_QUICK_OPEN, "Quick Open", true, None::<&str>)?;
    let open_notifications = MenuItem::with_id(
        manager,
        MENU_OPEN_NOTIFICATIONS,
        "Notifications",
        true,
        None::<&str>,
    )?;
    let mark_visible_notifications_read = MenuItem::with_id(
        manager,
        MENU_MARK_VISIBLE_NOTIFICATIONS_READ,
        "Mark Visible Notifications Read",
        false,
        None::<&str>,
    )?;
    let mark_all_notifications_read = MenuItem::with_id(
        manager,
        MENU_MARK_ALL_NOTIFICATIONS_READ,
        "Mark All Notifications Read",
        false,
        None::<&str>,
    )?;
    let hide_to_tray = MenuItem::with_id(
        manager,
        MENU_HIDE_TO_TRAY,
        "Hide to Tray",
        true,
        None::<&str>,
    )?;
    let open_app_data = MenuItem::with_id(
        manager,
        MENU_OPEN_APP_DATA,
        "Open Data Directory",
        true,
        None::<&str>,
    )?;
    let open_server_log = MenuItem::with_id(
        manager,
        MENU_OPEN_SERVER_LOG,
        "Open Server Log",
        true,
        None::<&str>,
    )?;
    let restart_server = MenuItem::with_id(
        manager,
        MENU_RESTART_SERVER,
        "Restart Bundled Server",
        true,
        None::<&str>,
    )?;
    let open_github =
        MenuItem::with_id(manager, MENU_OPEN_GITHUB, "Open GitHub", true, None::<&str>)?;
    let open_github_from_clipboard = MenuItem::with_id(
        manager,
        MENU_OPEN_GITHUB_FROM_CLIPBOARD,
        "Open GitHub URL from Clipboard",
        true,
        None::<&str>,
    )?;
    let copy_current_github = MenuItem::with_id(
        manager,
        MENU_COPY_CURRENT_GITHUB,
        "Copy Current GitHub URL",
        true,
        None::<&str>,
    )?;
    let copy_current_repository_clone_url = MenuItem::with_id(
        manager,
        MENU_COPY_CURRENT_REPOSITORY_CLONE_URL,
        "Copy Current Repository Clone URL",
        true,
        None::<&str>,
    )?;
    let clone_current_repository = MenuItem::with_id(
        manager,
        MENU_CLONE_CURRENT_REPOSITORY,
        "Clone Current Repository",
        true,
        None::<&str>,
    )?;
    let open_local_repository = MenuItem::with_id(
        manager,
        MENU_OPEN_LOCAL_REPOSITORY,
        "Open Local Repository",
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(manager, MENU_QUIT, "Quit", true, None::<&str>)?;

    let menu = MenuBuilder::new(manager)
        .item(&show_window)
        .item(&quick_open)
        .item(&open_notifications)
        .item(&mark_visible_notifications_read)
        .item(&mark_all_notifications_read)
        .item(&hide_to_tray)
        .separator()
        .item(&open_app_data)
        .item(&open_server_log)
        .item(&restart_server)
        .item(&open_github)
        .item(&open_github_from_clipboard)
        .item(&copy_current_github)
        .item(&copy_current_repository_clone_url)
        .item(&clone_current_repository)
        .item(&open_local_repository)
        .separator()
        .item(&quit)
        .build()?;

    Ok((
        menu,
        mark_visible_notifications_read,
        mark_all_notifications_read,
    ))
}
