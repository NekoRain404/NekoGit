//! Keyboard accelerator bindings for desktop menu items.

use super::ids::*;

pub(crate) const ACCEL_HIDE_TO_TRAY: &str = "Ctrl+Alt+H";
pub(crate) const ACCEL_QUIT: &str = "Ctrl+Q";
pub(crate) const ACCEL_RELOAD: &str = "Ctrl+R";
pub(crate) const ACCEL_RESTART_SERVER: &str = "Ctrl+Alt+R";
pub(crate) const ACCEL_REFRESH_CURRENT_VIEW: &str = "F5";
pub(crate) const ACCEL_OPEN_NOTIFICATIONS: &str = "Ctrl+Shift+N";
pub(crate) const ACCEL_MARK_VISIBLE_NOTIFICATIONS_READ: &str = "Ctrl+Alt+M";
pub(crate) const ACCEL_MARK_ALL_NOTIFICATIONS_READ: &str = "Ctrl+Shift+M";
pub(crate) const ACCEL_OPEN_SETTINGS: &str = "Ctrl+,";
pub(crate) const ACCEL_MANAGE_VIEWS: &str = "Ctrl+Shift+,";
pub(crate) const ACCEL_QUICK_OPEN: &str = "Ctrl+K";
pub(crate) const ACCEL_REVIEW_PREVIOUS_FILE: &str = "Alt+K";
pub(crate) const ACCEL_REVIEW_NEXT_FILE: &str = "Alt+J";
pub(crate) const ACCEL_REVIEW_NEXT_UNVIEWED_FILE: &str = "Alt+Shift+J";
pub(crate) const ACCEL_REVIEW_TOGGLE_CURRENT_FILE_VIEWED: &str = "Alt+Shift+M";
pub(crate) const ACCEL_REVIEW_TOGGLE_FILE_SIDEBAR: &str = "Alt+[";
pub(crate) const ACCEL_REVIEW_TOGGLE_REVIEW_PANEL: &str = "Alt+]";
pub(crate) const ACCEL_NAVIGATE_BACK: &str = "Alt+Left";
pub(crate) const ACCEL_NAVIGATE_FORWARD: &str = "Alt+Right";
pub(crate) const ACCEL_NAVIGATE_HOME: &str = "Alt+Home";
pub(crate) const ACCEL_OPEN_APP_DATA: &str = "Ctrl+Alt+D";
pub(crate) const ACCEL_OPEN_SERVER_LOG: &str = "Ctrl+Alt+L";
pub(crate) const ACCEL_OPEN_GITHUB: &str = "Ctrl+Alt+G";
pub(crate) const ACCEL_OPEN_CURRENT_GITHUB: &str = "Ctrl+Shift+G";
pub(crate) const ACCEL_OPEN_GITHUB_FROM_CLIPBOARD: &str = "Ctrl+Shift+O";
pub(crate) const ACCEL_COPY_CURRENT_GITHUB: &str = "Ctrl+Shift+L";
pub(crate) const ACCEL_COPY_CURRENT_REPOSITORY_CLONE_URL: &str = "Ctrl+Alt+C";
pub(crate) const ACCEL_CLONE_CURRENT_REPOSITORY: &str = "Ctrl+Shift+C";
pub(crate) const ACCEL_OPEN_LOCAL_REPOSITORY: &str = "Ctrl+Alt+O";

pub(crate) const DESKTOP_APP_MENU_ACCELERATORS: &[(&str, &str)] = &[
    (MENU_HIDE_TO_TRAY, ACCEL_HIDE_TO_TRAY),
    (MENU_QUIT, ACCEL_QUIT),
    (MENU_RELOAD, ACCEL_RELOAD),
    (MENU_RESTART_SERVER, ACCEL_RESTART_SERVER),
    (MENU_REFRESH_CURRENT_VIEW, ACCEL_REFRESH_CURRENT_VIEW),
    (MENU_OPEN_NOTIFICATIONS, ACCEL_OPEN_NOTIFICATIONS),
    (
        MENU_MARK_VISIBLE_NOTIFICATIONS_READ,
        ACCEL_MARK_VISIBLE_NOTIFICATIONS_READ,
    ),
    (
        MENU_MARK_ALL_NOTIFICATIONS_READ,
        ACCEL_MARK_ALL_NOTIFICATIONS_READ,
    ),
    (MENU_OPEN_SETTINGS, ACCEL_OPEN_SETTINGS),
    (MENU_MANAGE_VIEWS, ACCEL_MANAGE_VIEWS),
    (MENU_QUICK_OPEN, ACCEL_QUICK_OPEN),
    (MENU_REVIEW_PREVIOUS_FILE, ACCEL_REVIEW_PREVIOUS_FILE),
    (MENU_REVIEW_NEXT_FILE, ACCEL_REVIEW_NEXT_FILE),
    (
        MENU_REVIEW_NEXT_UNVIEWED_FILE,
        ACCEL_REVIEW_NEXT_UNVIEWED_FILE,
    ),
    (
        MENU_REVIEW_TOGGLE_CURRENT_FILE_VIEWED,
        ACCEL_REVIEW_TOGGLE_CURRENT_FILE_VIEWED,
    ),
    (
        MENU_REVIEW_TOGGLE_FILE_SIDEBAR,
        ACCEL_REVIEW_TOGGLE_FILE_SIDEBAR,
    ),
    (
        MENU_REVIEW_TOGGLE_REVIEW_PANEL,
        ACCEL_REVIEW_TOGGLE_REVIEW_PANEL,
    ),
    (MENU_NAVIGATE_BACK, ACCEL_NAVIGATE_BACK),
    (MENU_NAVIGATE_FORWARD, ACCEL_NAVIGATE_FORWARD),
    (MENU_NAVIGATE_HOME, ACCEL_NAVIGATE_HOME),
    (MENU_OPEN_APP_DATA, ACCEL_OPEN_APP_DATA),
    (MENU_OPEN_SERVER_LOG, ACCEL_OPEN_SERVER_LOG),
    (MENU_OPEN_GITHUB, ACCEL_OPEN_GITHUB),
    (MENU_OPEN_CURRENT_GITHUB, ACCEL_OPEN_CURRENT_GITHUB),
    (
        MENU_OPEN_GITHUB_FROM_CLIPBOARD,
        ACCEL_OPEN_GITHUB_FROM_CLIPBOARD,
    ),
    (MENU_COPY_CURRENT_GITHUB, ACCEL_COPY_CURRENT_GITHUB),
    (
        MENU_COPY_CURRENT_REPOSITORY_CLONE_URL,
        ACCEL_COPY_CURRENT_REPOSITORY_CLONE_URL,
    ),
    (
        MENU_CLONE_CURRENT_REPOSITORY,
        ACCEL_CLONE_CURRENT_REPOSITORY,
    ),
    (MENU_OPEN_LOCAL_REPOSITORY, ACCEL_OPEN_LOCAL_REPOSITORY),
];

/// Looks up the keyboard accelerator for a given menu item ID.
pub(crate) fn desktop_app_menu_accelerator(item_id: &str) -> Option<&'static str> {
    DESKTOP_APP_MENU_ACCELERATORS
        .iter()
        .find_map(|(id, accelerator)| (*id == item_id).then_some(*accelerator))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_desktop_menu_items_to_expected_accelerators() {
        assert_eq!(
            desktop_app_menu_accelerator(MENU_OPEN_SETTINGS),
            Some(ACCEL_OPEN_SETTINGS)
        );
        assert_eq!(
            desktop_app_menu_accelerator(MENU_REFRESH_CURRENT_VIEW),
            Some(ACCEL_REFRESH_CURRENT_VIEW)
        );
        assert_eq!(
            desktop_app_menu_accelerator(MENU_OPEN_CURRENT_GITHUB),
            Some(ACCEL_OPEN_CURRENT_GITHUB)
        );
        assert_eq!(
            desktop_app_menu_accelerator(MENU_CLONE_CURRENT_REPOSITORY),
            Some(ACCEL_CLONE_CURRENT_REPOSITORY)
        );
        assert_eq!(
            desktop_app_menu_accelerator(MENU_COPY_CURRENT_REPOSITORY_CLONE_URL),
            Some(ACCEL_COPY_CURRENT_REPOSITORY_CLONE_URL)
        );
        assert_eq!(
            desktop_app_menu_accelerator(MENU_OPEN_LOCAL_REPOSITORY),
            Some(ACCEL_OPEN_LOCAL_REPOSITORY)
        );
        assert_eq!(
            desktop_app_menu_accelerator(MENU_QUICK_OPEN),
            Some(ACCEL_QUICK_OPEN)
        );
        assert_eq!(
            desktop_app_menu_accelerator(MENU_REVIEW_PREVIOUS_FILE),
            Some(ACCEL_REVIEW_PREVIOUS_FILE)
        );
        assert_eq!(
            desktop_app_menu_accelerator(MENU_REVIEW_NEXT_FILE),
            Some(ACCEL_REVIEW_NEXT_FILE)
        );
        assert_eq!(
            desktop_app_menu_accelerator(MENU_REVIEW_NEXT_UNVIEWED_FILE),
            Some(ACCEL_REVIEW_NEXT_UNVIEWED_FILE)
        );
        assert_eq!(
            desktop_app_menu_accelerator(MENU_REVIEW_TOGGLE_CURRENT_FILE_VIEWED),
            Some(ACCEL_REVIEW_TOGGLE_CURRENT_FILE_VIEWED)
        );
        assert_eq!(
            desktop_app_menu_accelerator(MENU_REVIEW_TOGGLE_FILE_SIDEBAR),
            Some(ACCEL_REVIEW_TOGGLE_FILE_SIDEBAR)
        );
        assert_eq!(
            desktop_app_menu_accelerator(MENU_REVIEW_TOGGLE_REVIEW_PANEL),
            Some(ACCEL_REVIEW_TOGGLE_REVIEW_PANEL)
        );
        assert_eq!(
            desktop_app_menu_accelerator(MENU_HIDE_TO_TRAY),
            Some(ACCEL_HIDE_TO_TRAY)
        );
        assert_eq!(desktop_app_menu_accelerator(MENU_SHOW_WINDOW), None);
    }

    #[test]
    fn keeps_desktop_app_menu_accelerators_unique() {
        let mut seen = std::collections::HashSet::new();

        for (item_id, accelerator) in DESKTOP_APP_MENU_ACCELERATORS {
            assert!(
                seen.insert(*accelerator),
                "duplicate desktop menu accelerator `{accelerator}` for `{item_id}`"
            );
            assert_eq!(desktop_app_menu_accelerator(item_id), Some(*accelerator));
        }
    }
}
