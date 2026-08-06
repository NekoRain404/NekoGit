//! Builds the application Help submenu.

use tauri::{
    menu::{Submenu, SubmenuBuilder},
    Manager, Runtime,
};

use crate::desktop_menu::ids::MENU_OPEN_GITHUB;

use super::item::app_menu_item;

/// Builds the Help submenu (Open GitHub).
pub(super) fn build_help_menu<R: Runtime, M: Manager<R>>(manager: &M) -> tauri::Result<Submenu<R>> {
    let open_github = app_menu_item(manager, MENU_OPEN_GITHUB, "Open GitHub", true)?;

    SubmenuBuilder::new(manager, "Help")
        .item(&open_github)
        .build()
}
