//! Builds the application Review submenu (file review navigation and toggles).

use tauri::{
    menu::{Submenu, SubmenuBuilder},
    Manager, Runtime,
};

use crate::desktop_menu::{
    ids::{
        MENU_REVIEW_NEXT_FILE, MENU_REVIEW_NEXT_UNVIEWED_FILE, MENU_REVIEW_PREVIOUS_FILE,
        MENU_REVIEW_TOGGLE_CURRENT_FILE_VIEWED, MENU_REVIEW_TOGGLE_FILE_SIDEBAR,
        MENU_REVIEW_TOGGLE_REVIEW_PANEL,
    },
    items::DesktopReviewMenu,
};

use super::item::app_menu_item;

pub(super) struct ReviewMenuGroup<R: Runtime> {
    pub(super) menu: Submenu<R>,
    pub(super) review_menu: DesktopReviewMenu<R>,
}

/// Builds the Review submenu for code review file navigation and toggles.
pub(super) fn build_review_menu<R: Runtime, M: Manager<R>>(
    manager: &M,
) -> tauri::Result<ReviewMenuGroup<R>> {
    let review_previous_file = app_menu_item(
        manager,
        MENU_REVIEW_PREVIOUS_FILE,
        "Previous Review File",
        false,
    )?;
    let review_next_file =
        app_menu_item(manager, MENU_REVIEW_NEXT_FILE, "Next Review File", false)?;
    let review_next_unviewed_file = app_menu_item(
        manager,
        MENU_REVIEW_NEXT_UNVIEWED_FILE,
        "Next Unviewed Review File",
        false,
    )?;
    let review_toggle_current_file_viewed = app_menu_item(
        manager,
        MENU_REVIEW_TOGGLE_CURRENT_FILE_VIEWED,
        "Toggle Current File Viewed",
        false,
    )?;
    let review_toggle_file_sidebar = app_menu_item(
        manager,
        MENU_REVIEW_TOGGLE_FILE_SIDEBAR,
        "Toggle Review File Sidebar",
        false,
    )?;
    let review_toggle_review_panel = app_menu_item(
        manager,
        MENU_REVIEW_TOGGLE_REVIEW_PANEL,
        "Toggle Review Panel",
        false,
    )?;

    let menu = SubmenuBuilder::new(manager, "Review")
        .item(&review_previous_file)
        .item(&review_next_file)
        .item(&review_next_unviewed_file)
        .separator()
        .item(&review_toggle_current_file_viewed)
        .separator()
        .item(&review_toggle_file_sidebar)
        .item(&review_toggle_review_panel)
        .build()?;

    Ok(ReviewMenuGroup {
        menu,
        review_menu: DesktopReviewMenu {
            previous_file: review_previous_file,
            next_file: review_next_file,
            next_unviewed_file: review_next_unviewed_file,
            toggle_current_file_viewed: review_toggle_current_file_viewed,
            toggle_file_sidebar: review_toggle_file_sidebar,
            toggle_review_panel: review_toggle_review_panel,
        },
    })
}
