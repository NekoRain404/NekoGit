//! Main window behavior: navigation, visibility toggling, and title updates.
mod constants;
mod navigation;
mod title;
mod visibility;

pub(crate) use constants::{DEFAULT_WINDOW_HEIGHT, DEFAULT_WINDOW_WIDTH, MAIN_WINDOW_LABEL};
pub(crate) use navigation::{
    handle_navigation, handle_new_window_navigation, open_github_launch_url,
};
pub(crate) use title::update_desktop_window_title;
pub(crate) use visibility::{hide_main_window, show_main_window};
