//! Application menu and system tray menu construction, state management, and identifiers.

mod accelerators;
mod app;
mod ids;
mod items;
mod state;
mod tray;

pub(crate) use app::build_app_menu;
pub(crate) use ids::*;
pub(crate) use items::{
    DesktopCurrentGitHubMenu, DesktopCurrentGitHubState, DesktopNavigationMenu,
    DesktopNavigationState, DesktopNotificationMenu, DesktopReviewMenu, DesktopReviewState,
};
pub(crate) use state::{
    apply_desktop_current_github_state, apply_desktop_navigation_state,
    apply_desktop_notification_menu_state, apply_desktop_review_state,
};
pub(crate) use tray::build_tray_menu;
