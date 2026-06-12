//! App menu construction grouped by File, Navigate, Review, View, and Help sections.
mod file;
mod help;
mod item;
mod navigate;
mod review;
mod view;

use tauri::{menu::MenuBuilder, Manager, Runtime};

use super::items::DesktopAppMenu;

/// Assembles the full native application menu bar from submenus.
pub(crate) fn build_app_menu<R: Runtime, M: Manager<R>>(
    manager: &M,
) -> tauri::Result<DesktopAppMenu<R>> {
    let file_menu = file::build_file_menu(manager)?;
    let navigate_menu = navigate::build_navigate_menu(manager)?;
    let review_menu = review::build_review_menu(manager)?;
    let view_menu = view::build_view_menu(manager)?;
    let help_menu = help::build_help_menu(manager)?;

    let menu = MenuBuilder::new(manager)
        .item(&file_menu)
        .item(&navigate_menu.menu)
        .item(&review_menu.menu)
        .item(&view_menu)
        .item(&help_menu)
        .build()?;

    Ok(DesktopAppMenu {
        menu,
        navigation_menu: navigate_menu.navigation_menu,
        review_menu: review_menu.review_menu,
        current_github_menu: navigate_menu.current_github_menu,
        mark_visible_notifications_read: navigate_menu.mark_visible_notifications_read,
        mark_all_notifications_read: navigate_menu.mark_all_notifications_read,
    })
}
