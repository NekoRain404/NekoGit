//! Menu event dispatch — routes native menu selections to window, system, and frontend actions.
mod frontend;
mod system;
mod window;

use tauri::Runtime;

pub(crate) fn handle_menu_event<R: Runtime>(app: &tauri::AppHandle<R>, item_id: &str) {
    if window::handle_window_menu_event(app, item_id) {
        return;
    }

    if frontend::handle_frontend_menu_event(app, item_id) {
        return;
    }

    system::handle_system_menu_event(app, item_id);
}
