//! Window dimension constants for Window state persistence.

pub(crate) const WINDOW_STATE_FILE: &str = "window-state.json";
pub(crate) const MIN_WINDOW_HEIGHT: f64 = 680.0;
pub(crate) const MIN_WINDOW_WIDTH: f64 = 1024.0;

pub(super) const MAX_WINDOW_COORDINATE_ABS: f64 = 100_000.0;
pub(super) const MAX_WINDOW_DIMENSION: f64 = 16_000.0;
