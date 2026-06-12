use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem},
    Runtime,
};

/// Holds the back/forward navigation menu items for runtime state updates.
pub(crate) struct DesktopNavigationMenu<R: Runtime> {
    pub(super) back: MenuItem<R>,
    pub(super) forward: MenuItem<R>,
}

/// Aggregated application menu with all submenu groups and mutable items.
pub(crate) struct DesktopAppMenu<R: Runtime> {
    pub(crate) menu: Menu<R>,
    pub(crate) navigation_menu: DesktopNavigationMenu<R>,
    pub(crate) review_menu: DesktopReviewMenu<R>,
    pub(crate) current_github_menu: DesktopCurrentGitHubMenu<R>,
    pub(crate) mark_visible_notifications_read: MenuItem<R>,
    pub(crate) mark_all_notifications_read: MenuItem<R>,
}

/// Review submenu items for file navigation and toggles.
pub(crate) struct DesktopReviewMenu<R: Runtime> {
    pub(super) previous_file: MenuItem<R>,
    pub(super) next_file: MenuItem<R>,
    pub(super) next_unviewed_file: MenuItem<R>,
    pub(super) toggle_current_file_viewed: MenuItem<R>,
    pub(super) toggle_file_sidebar: MenuItem<R>,
    pub(super) toggle_review_panel: MenuItem<R>,
}

/// GitHub context menu items for the current page/repository.
pub(crate) struct DesktopCurrentGitHubMenu<R: Runtime> {
    pub(super) open_current_github: MenuItem<R>,
    pub(super) copy_current_github: MenuItem<R>,
    pub(super) copy_current_repository_clone_url: MenuItem<R>,
    pub(super) clone_current_repository: MenuItem<R>,
    pub(super) open_local_repository: MenuItem<R>,
}

/// Notification mark-read menu items in both the app menu and tray menu.
pub(crate) struct DesktopNotificationMenu<R: Runtime> {
    pub(crate) app_mark_visible_read: MenuItem<R>,
    pub(crate) app_mark_all_read: MenuItem<R>,
    pub(crate) tray_mark_visible_read: MenuItem<R>,
    pub(crate) tray_mark_all_read: MenuItem<R>,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
/// Serializable navigation state sent from the frontend to update menu enabled flags.
pub(crate) struct DesktopNavigationState {
    pub(super) can_go_back: bool,
    pub(super) can_go_forward: bool,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
/// Serializable review state sent from the frontend to update menu enabled flags.
pub(crate) struct DesktopReviewState {
    pub(super) active: bool,
    pub(super) can_select_previous_file: bool,
    pub(super) can_select_next_file: bool,
    pub(super) can_select_next_unviewed_file: bool,
    pub(super) can_toggle_current_file_viewed: bool,
    pub(super) can_toggle_file_sidebar: bool,
    pub(super) can_toggle_review_panel: bool,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
/// Serializable GitHub context state sent from the frontend.
pub(crate) struct DesktopCurrentGitHubState {
    pub(super) has_current_url: bool,
    pub(super) has_current_repository: bool,
    pub(super) has_current_local_repository: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_desktop_navigation_state_from_frontend() {
        let state = DesktopNavigationState {
            can_go_back: true,
            can_go_forward: false,
        };

        assert_eq!(
            serde_json::to_string(&state).unwrap(),
            r#"{"canGoBack":true,"canGoForward":false}"#
        );
        assert_eq!(
            serde_json::from_str::<DesktopNavigationState>(
                r#"{"canGoBack":false,"canGoForward":true}"#
            )
            .unwrap(),
            DesktopNavigationState {
                can_go_back: false,
                can_go_forward: true,
            }
        );
    }

    #[test]
    fn serializes_desktop_review_state_from_frontend() {
        let state = DesktopReviewState {
            active: true,
            can_select_previous_file: true,
            can_select_next_file: false,
            can_select_next_unviewed_file: true,
            can_toggle_current_file_viewed: true,
            can_toggle_file_sidebar: true,
            can_toggle_review_panel: true,
        };

        assert_eq!(
            serde_json::to_string(&state).unwrap(),
            r#"{"active":true,"canSelectPreviousFile":true,"canSelectNextFile":false,"canSelectNextUnviewedFile":true,"canToggleCurrentFileViewed":true,"canToggleFileSidebar":true,"canToggleReviewPanel":true}"#
        );
        assert_eq!(
            serde_json::from_str::<DesktopReviewState>(
                r#"{"active":false,"canSelectPreviousFile":false,"canSelectNextFile":false,"canSelectNextUnviewedFile":false,"canToggleCurrentFileViewed":false,"canToggleFileSidebar":false,"canToggleReviewPanel":false}"#
            )
            .unwrap(),
            DesktopReviewState {
                active: false,
                can_select_previous_file: false,
                can_select_next_file: false,
                can_select_next_unviewed_file: false,
                can_toggle_current_file_viewed: false,
                can_toggle_file_sidebar: false,
                can_toggle_review_panel: false,
            }
        );
    }

    #[test]
    fn serializes_desktop_current_github_state_from_frontend() {
        let state = DesktopCurrentGitHubState {
            has_current_url: true,
            has_current_repository: true,
            has_current_local_repository: true,
        };

        assert_eq!(
            serde_json::to_string(&state).unwrap(),
            r#"{"hasCurrentUrl":true,"hasCurrentRepository":true,"hasCurrentLocalRepository":true}"#
        );
        assert_eq!(
            serde_json::from_str::<DesktopCurrentGitHubState>(
                r#"{"hasCurrentUrl":false,"hasCurrentRepository":false,"hasCurrentLocalRepository":false}"#
            )
            .unwrap(),
            DesktopCurrentGitHubState {
                has_current_url: false,
                has_current_repository: false,
                has_current_local_repository: false,
            }
        );
    }
}
