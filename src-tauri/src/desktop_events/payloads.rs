use serde::Serialize;

// The serialized kebab-case values are part of the frontend desktop command contract.
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
/// High-level commands the backend can dispatch to the frontend UI.
pub(crate) enum DesktopCommandAction {
    RefreshCurrentView,
    OpenNotifications,
    MarkVisibleNotificationsRead,
    MarkAllNotificationsRead,
    OpenSettings,
    ManageViews,
    QuickOpen,
    ReviewPreviousFile,
    ReviewNextFile,
    ReviewNextUnviewedFile,
    ReviewToggleCurrentFileViewed,
    ReviewToggleFileSidebar,
    ReviewToggleReviewPanel,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct DesktopCommandPayload {
    pub(super) action: DesktopCommandAction,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
/// Navigation actions the backend can request from the frontend router.
pub(crate) enum DesktopNavigationAction {
    Back,
    Forward,
    Home,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct DesktopNavigationPayload {
    pub(super) action: DesktopNavigationAction,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_desktop_navigation_payload_for_frontend_listener() {
        let payload = DesktopNavigationPayload {
            action: DesktopNavigationAction::Forward,
        };

        assert_eq!(
            serde_json::to_string(&payload).unwrap(),
            r#"{"action":"forward"}"#
        );
    }

    #[test]
    fn serializes_desktop_command_payload_for_frontend_listener() {
        let payload = DesktopCommandPayload {
            action: DesktopCommandAction::RefreshCurrentView,
        };

        assert_eq!(
            serde_json::to_string(&payload).unwrap(),
            r#"{"action":"refresh-current-view"}"#
        );
    }

    #[test]
    fn serializes_open_notifications_command_payload_for_frontend_listener() {
        let payload = DesktopCommandPayload {
            action: DesktopCommandAction::OpenNotifications,
        };

        assert_eq!(
            serde_json::to_string(&payload).unwrap(),
            r#"{"action":"open-notifications"}"#
        );
    }

    #[test]
    fn serializes_mark_visible_notifications_read_command_payload_for_frontend_listener() {
        let payload = DesktopCommandPayload {
            action: DesktopCommandAction::MarkVisibleNotificationsRead,
        };

        assert_eq!(
            serde_json::to_string(&payload).unwrap(),
            r#"{"action":"mark-visible-notifications-read"}"#
        );
    }

    #[test]
    fn serializes_mark_all_notifications_read_command_payload_for_frontend_listener() {
        let payload = DesktopCommandPayload {
            action: DesktopCommandAction::MarkAllNotificationsRead,
        };

        assert_eq!(
            serde_json::to_string(&payload).unwrap(),
            r#"{"action":"mark-all-notifications-read"}"#
        );
    }

    #[test]
    fn serializes_quick_open_command_payload_for_frontend_listener() {
        let payload = DesktopCommandPayload {
            action: DesktopCommandAction::QuickOpen,
        };

        assert_eq!(
            serde_json::to_string(&payload).unwrap(),
            r#"{"action":"quick-open"}"#
        );
    }

    #[test]
    fn serializes_review_command_payloads_for_frontend_listener() {
        let cases = [
            (
                DesktopCommandAction::ReviewPreviousFile,
                r#"{"action":"review-previous-file"}"#,
            ),
            (
                DesktopCommandAction::ReviewNextFile,
                r#"{"action":"review-next-file"}"#,
            ),
            (
                DesktopCommandAction::ReviewNextUnviewedFile,
                r#"{"action":"review-next-unviewed-file"}"#,
            ),
            (
                DesktopCommandAction::ReviewToggleCurrentFileViewed,
                r#"{"action":"review-toggle-current-file-viewed"}"#,
            ),
            (
                DesktopCommandAction::ReviewToggleFileSidebar,
                r#"{"action":"review-toggle-file-sidebar"}"#,
            ),
            (
                DesktopCommandAction::ReviewToggleReviewPanel,
                r#"{"action":"review-toggle-review-panel"}"#,
            ),
        ];

        for (action, expected) in cases {
            let payload = DesktopCommandPayload { action };
            assert_eq!(serde_json::to_string(&payload).unwrap(), expected);
        }
    }
}
