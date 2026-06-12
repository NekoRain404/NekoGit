//! Persisted window bounds and maximized state, with safe restore normalization.
mod capture;
mod constants;
mod store;
mod validation;

pub(crate) use capture::{save_main_window_state, save_window_state};
pub(crate) use constants::{MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH, WINDOW_STATE_FILE};
pub(crate) use store::DesktopWindowStateStore;

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
pub(crate) struct DesktopWindowState {
    pub(crate) x: f64,
    pub(crate) y: f64,
    pub(crate) width: f64,
    pub(crate) height: f64,
    pub(crate) maximized: bool,
}
