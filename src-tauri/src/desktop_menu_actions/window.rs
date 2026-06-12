//! Window control menu actions for Desktop menu action handlers.

use tauri::{Manager, Runtime};

use crate::{
    desktop_menu::{MENU_HIDE_TO_TRAY, MENU_QUIT, MENU_RELOAD, MENU_SHOW_WINDOW},
    desktop_window::{hide_main_window, show_main_window, MAIN_WINDOW_LABEL},
    desktop_window_state::save_main_window_state,
};

pub(super) fn handle_window_menu_event<R: Runtime>(
    app: &tauri::AppHandle<R>,
    item_id: &str,
) -> bool {
    match item_id {
        MENU_SHOW_WINDOW => {
            if let Err(error) = show_main_window(app) {
                eprintln!("{error}");
            }
        }
        MENU_HIDE_TO_TRAY => {
            if let Err(error) = hide_main_window(app) {
                eprintln!("{error}");
            }
        }
        MENU_RELOAD => {
            if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                if let Err(error) = window.reload() {
                    eprintln!("failed to reload NekoGit window: {error}");
                }
            }
        }
        MENU_QUIT => {
            save_main_window_state(app, MAIN_WINDOW_LABEL);
            app.exit(0);
        }
        _ => return false,
    }

    true
}
