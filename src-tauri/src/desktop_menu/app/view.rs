use tauri::{
    menu::{Submenu, SubmenuBuilder},
    Manager, Runtime,
};

use crate::desktop_menu::ids::{MENU_MANAGE_VIEWS, MENU_REFRESH_CURRENT_VIEW, MENU_RELOAD};

use super::item::app_menu_item;

/// Builds the View submenu (refresh, reload, manage views).
pub(super) fn build_view_menu<R: Runtime, M: Manager<R>>(manager: &M) -> tauri::Result<Submenu<R>> {
    let refresh_current_view = app_menu_item(
        manager,
        MENU_REFRESH_CURRENT_VIEW,
        "Refresh Current View",
        true,
    )?;
    let reload = app_menu_item(manager, MENU_RELOAD, "Reload", true)?;
    let manage_views = app_menu_item(manager, MENU_MANAGE_VIEWS, "Manage Views", true)?;

    SubmenuBuilder::new(manager, "View")
        .item(&refresh_current_view)
        .item(&reload)
        .separator()
        .item(&manage_views)
        .build()
}
