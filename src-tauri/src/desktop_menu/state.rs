//! Applies frontend state changes to native menu item enabled flags.

use tauri::Runtime;

use super::items::{
    DesktopCurrentGitHubMenu, DesktopCurrentGitHubState, DesktopNavigationMenu,
    DesktopNavigationState, DesktopNotificationMenu, DesktopReviewMenu, DesktopReviewState,
};

/// Enables or disables back/forward menu items based on router state.
pub(crate) fn apply_desktop_navigation_state<R: Runtime>(
    menu: &DesktopNavigationMenu<R>,
    state: DesktopNavigationState,
) -> Result<(), String> {
    menu.back
        .set_enabled(state.can_go_back)
        .map_err(|error| format!("failed to update NekoGit back menu state: {error}"))?;
    menu.forward
        .set_enabled(state.can_go_forward)
        .map_err(|error| format!("failed to update NekoGit forward menu state: {error}"))
}

/// Enables or disables review menu items based on the review panel state.
pub(crate) fn apply_desktop_review_state<R: Runtime>(
    menu: &DesktopReviewMenu<R>,
    state: DesktopReviewState,
) -> Result<(), String> {
    let active = state.active;
    menu.previous_file
        .set_enabled(active && state.can_select_previous_file)
        .map_err(|error| {
            format!("failed to update NekoGit previous review file menu state: {error}")
        })?;
    menu.next_file
        .set_enabled(active && state.can_select_next_file)
        .map_err(|error| {
            format!("failed to update NekoGit next review file menu state: {error}")
        })?;
    menu.next_unviewed_file
        .set_enabled(active && state.can_select_next_unviewed_file)
        .map_err(|error| {
            format!("failed to update NekoGit next unviewed review file menu state: {error}")
        })?;
    menu.toggle_current_file_viewed
        .set_enabled(active && state.can_toggle_current_file_viewed)
        .map_err(|error| {
            format!("failed to update NekoGit viewed review file menu state: {error}")
        })?;
    menu.toggle_file_sidebar
        .set_enabled(active && state.can_toggle_file_sidebar)
        .map_err(|error| {
            format!("failed to update NekoGit review file sidebar menu state: {error}")
        })?;
    menu.toggle_review_panel
        .set_enabled(active && state.can_toggle_review_panel)
        .map_err(|error| format!("failed to update NekoGit review panel menu state: {error}"))
}

/// Enables or disables GitHub context menu items based on the current page.
pub(crate) fn apply_desktop_current_github_state<R: Runtime>(
    menu: &DesktopCurrentGitHubMenu<R>,
    state: DesktopCurrentGitHubState,
) -> Result<(), String> {
    menu.open_current_github
        .set_enabled(state.has_current_url)
        .map_err(|error| {
            format!("failed to update NekoGit open-current-GitHub menu state: {error}")
        })?;
    menu.copy_current_github
        .set_enabled(state.has_current_url)
        .map_err(|error| {
            format!("failed to update NekoGit copy-current-GitHub menu state: {error}")
        })?;
    menu.copy_current_repository_clone_url
        .set_enabled(state.has_current_repository)
        .map_err(|error| {
            format!(
                "failed to update NekoGit copy-current-repository-clone-url menu state: {error}"
            )
        })?;
    menu.clone_current_repository
        .set_enabled(state.has_current_repository)
        .map_err(|error| {
            format!("failed to update NekoGit clone-current-repository menu state: {error}")
        })?;
    menu.open_local_repository
        .set_enabled(state.has_current_local_repository)
        .map_err(|error| {
            format!("failed to update NekoGit open-local-repository menu state: {error}")
        })
}

/// Enables or disables mark-read menu items based on the unread count.
pub(crate) fn apply_desktop_notification_menu_state<R: Runtime>(
    menu: &DesktopNotificationMenu<R>,
    unread_count: u32,
) -> Result<(), String> {
    let has_unread = unread_count > 0;
    menu.app_mark_visible_read
        .set_enabled(has_unread)
        .map_err(|error| {
            format!("failed to update NekoGit visible notification menu state: {error}")
        })?;
    menu.app_mark_all_read
        .set_enabled(has_unread)
        .map_err(|error| format!("failed to update NekoGit notification menu state: {error}"))?;
    menu.tray_mark_visible_read
        .set_enabled(has_unread)
        .map_err(|error| {
            format!("failed to update NekoGit tray visible notification menu state: {error}")
        })?;
    menu.tray_mark_all_read
        .set_enabled(has_unread)
        .map_err(|error| format!("failed to update NekoGit tray notification menu state: {error}"))
}
