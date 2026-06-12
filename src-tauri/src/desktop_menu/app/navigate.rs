use tauri::{
    menu::{MenuItem, Submenu, SubmenuBuilder},
    Manager, Runtime,
};

use crate::desktop_menu::{
    ids::{
        MENU_CLONE_CURRENT_REPOSITORY, MENU_COPY_CURRENT_GITHUB,
        MENU_COPY_CURRENT_REPOSITORY_CLONE_URL, MENU_MARK_ALL_NOTIFICATIONS_READ,
        MENU_MARK_VISIBLE_NOTIFICATIONS_READ, MENU_NAVIGATE_BACK, MENU_NAVIGATE_FORWARD,
        MENU_NAVIGATE_HOME, MENU_OPEN_CURRENT_GITHUB, MENU_OPEN_GITHUB_FROM_CLIPBOARD,
        MENU_OPEN_LOCAL_REPOSITORY, MENU_OPEN_NOTIFICATIONS, MENU_QUICK_OPEN,
    },
    items::{DesktopCurrentGitHubMenu, DesktopNavigationMenu},
};

use super::item::app_menu_item;

pub(super) struct NavigateMenuGroup<R: Runtime> {
    pub(super) menu: Submenu<R>,
    pub(super) navigation_menu: DesktopNavigationMenu<R>,
    pub(super) current_github_menu: DesktopCurrentGitHubMenu<R>,
    pub(super) mark_visible_notifications_read: MenuItem<R>,
    pub(super) mark_all_notifications_read: MenuItem<R>,
}

/// Builds the Navigate submenu and returns grouped menu items for runtime state binding.
pub(super) fn build_navigate_menu<R: Runtime, M: Manager<R>>(
    manager: &M,
) -> tauri::Result<NavigateMenuGroup<R>> {
    let quick_open = app_menu_item(manager, MENU_QUICK_OPEN, "Quick Open", true)?;
    let navigate_back = app_menu_item(manager, MENU_NAVIGATE_BACK, "Back", false)?;
    let navigate_forward = app_menu_item(manager, MENU_NAVIGATE_FORWARD, "Forward", false)?;
    let navigate_home = app_menu_item(manager, MENU_NAVIGATE_HOME, "Dashboard", true)?;
    let open_notifications =
        app_menu_item(manager, MENU_OPEN_NOTIFICATIONS, "Notifications", true)?;
    let mark_visible_notifications_read = app_menu_item(
        manager,
        MENU_MARK_VISIBLE_NOTIFICATIONS_READ,
        "Mark Visible Notifications Read",
        false,
    )?;
    let mark_all_notifications_read = app_menu_item(
        manager,
        MENU_MARK_ALL_NOTIFICATIONS_READ,
        "Mark All Notifications Read",
        false,
    )?;
    let open_current_github = app_menu_item(
        manager,
        MENU_OPEN_CURRENT_GITHUB,
        "Open Current Page on GitHub",
        false,
    )?;
    let open_github_from_clipboard = app_menu_item(
        manager,
        MENU_OPEN_GITHUB_FROM_CLIPBOARD,
        "Open GitHub URL from Clipboard",
        true,
    )?;
    let copy_current_github = app_menu_item(
        manager,
        MENU_COPY_CURRENT_GITHUB,
        "Copy Current GitHub URL",
        false,
    )?;
    let copy_current_repository_clone_url = app_menu_item(
        manager,
        MENU_COPY_CURRENT_REPOSITORY_CLONE_URL,
        "Copy Current Repository Clone URL",
        false,
    )?;
    let clone_current_repository = app_menu_item(
        manager,
        MENU_CLONE_CURRENT_REPOSITORY,
        "Clone Current Repository",
        false,
    )?;
    let open_local_repository = app_menu_item(
        manager,
        MENU_OPEN_LOCAL_REPOSITORY,
        "Open Local Repository",
        false,
    )?;

    let menu = SubmenuBuilder::new(manager, "Navigate")
        .item(&quick_open)
        .separator()
        .item(&navigate_back)
        .item(&navigate_forward)
        .item(&navigate_home)
        .item(&open_notifications)
        .item(&mark_visible_notifications_read)
        .item(&mark_all_notifications_read)
        .separator()
        .item(&open_current_github)
        .item(&open_github_from_clipboard)
        .item(&copy_current_github)
        .separator()
        .item(&copy_current_repository_clone_url)
        .item(&clone_current_repository)
        .item(&open_local_repository)
        .build()?;

    Ok(NavigateMenuGroup {
        menu,
        navigation_menu: DesktopNavigationMenu {
            back: navigate_back,
            forward: navigate_forward,
        },
        current_github_menu: DesktopCurrentGitHubMenu {
            open_current_github,
            copy_current_github,
            copy_current_repository_clone_url,
            clone_current_repository,
            open_local_repository,
        },
        mark_visible_notifications_read,
        mark_all_notifications_read,
    })
}
