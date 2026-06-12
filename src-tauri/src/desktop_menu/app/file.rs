use tauri::{
    menu::{Submenu, SubmenuBuilder},
    Manager, Runtime,
};

use crate::desktop_menu::ids::{
    MENU_HIDE_TO_TRAY, MENU_OPEN_APP_DATA, MENU_OPEN_SERVER_LOG, MENU_OPEN_SETTINGS, MENU_QUIT,
    MENU_RESTART_SERVER,
};

use super::item::app_menu_item;

/// Builds the File submenu (settings, data directory, server management, quit).
pub(super) fn build_file_menu<R: Runtime, M: Manager<R>>(manager: &M) -> tauri::Result<Submenu<R>> {
    let open_settings = app_menu_item(manager, MENU_OPEN_SETTINGS, "Settings", true)?;
    let open_app_data = app_menu_item(manager, MENU_OPEN_APP_DATA, "Open Data Directory", true)?;
    let open_server_log = app_menu_item(manager, MENU_OPEN_SERVER_LOG, "Open Server Log", true)?;
    let restart_server =
        app_menu_item(manager, MENU_RESTART_SERVER, "Restart Bundled Server", true)?;
    let hide_to_tray = app_menu_item(manager, MENU_HIDE_TO_TRAY, "Hide to Tray", true)?;
    let quit = app_menu_item(manager, MENU_QUIT, "Quit", true)?;

    SubmenuBuilder::new(manager, "File")
        .item(&open_settings)
        .separator()
        .item(&open_app_data)
        .item(&open_server_log)
        .item(&restart_server)
        .separator()
        .item(&hide_to_tray)
        .separator()
        .item(&quit)
        .build()
}
