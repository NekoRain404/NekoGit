//! Window state validation for Window state persistence.

use super::{
    constants::{
        MAX_WINDOW_COORDINATE_ABS, MAX_WINDOW_DIMENSION, MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH,
    },
    DesktopWindowState,
};

fn is_finite_window_state_value(value: f64) -> bool {
    value.is_finite()
}

pub(super) fn is_valid_window_state(state: &DesktopWindowState) -> bool {
    [state.x, state.y, state.width, state.height]
        .into_iter()
        .all(is_finite_window_state_value)
        && state.x.abs() <= MAX_WINDOW_COORDINATE_ABS
        && state.y.abs() <= MAX_WINDOW_COORDINATE_ABS
        && state.width >= MIN_WINDOW_WIDTH
        && state.height >= MIN_WINDOW_HEIGHT
        && state.width <= MAX_WINDOW_DIMENSION
        && state.height <= MAX_WINDOW_DIMENSION
}

pub(super) fn normalize_window_state(state: DesktopWindowState) -> Option<DesktopWindowState> {
    if ![state.x, state.y, state.width, state.height]
        .into_iter()
        .all(is_finite_window_state_value)
        || state.x.abs() > MAX_WINDOW_COORDINATE_ABS
        || state.y.abs() > MAX_WINDOW_COORDINATE_ABS
    {
        return None;
    }

    let state = DesktopWindowState {
        width: state.width.clamp(MIN_WINDOW_WIDTH, MAX_WINDOW_DIMENSION),
        height: state.height.clamp(MIN_WINDOW_HEIGHT, MAX_WINDOW_DIMENSION),
        ..state
    };

    is_valid_window_state(&state).then_some(state)
}

#[cfg(test)]
mod tests {
    use super::*;

    const DEFAULT_TEST_WINDOW_HEIGHT: f64 = 860.0;
    const DEFAULT_TEST_WINDOW_WIDTH: f64 = 1280.0;

    #[test]
    fn accepts_valid_desktop_window_state() {
        let state = DesktopWindowState {
            x: 50.0,
            y: 80.0,
            width: DEFAULT_TEST_WINDOW_WIDTH,
            height: DEFAULT_TEST_WINDOW_HEIGHT,
            maximized: false,
        };

        assert!(is_valid_window_state(&state));
        assert_eq!(normalize_window_state(state), Some(state));
    }

    #[test]
    fn rejects_non_finite_desktop_window_state() {
        let state = DesktopWindowState {
            x: f64::NAN,
            y: 80.0,
            width: DEFAULT_TEST_WINDOW_WIDTH,
            height: DEFAULT_TEST_WINDOW_HEIGHT,
            maximized: false,
        };

        assert!(!is_valid_window_state(&state));
        assert_eq!(normalize_window_state(state), None);
    }

    #[test]
    fn rejects_desktop_window_state_with_huge_coordinates() {
        let state = DesktopWindowState {
            x: MAX_WINDOW_COORDINATE_ABS + 1.0,
            y: 80.0,
            width: DEFAULT_TEST_WINDOW_WIDTH,
            height: DEFAULT_TEST_WINDOW_HEIGHT,
            maximized: false,
        };

        assert!(!is_valid_window_state(&state));
        assert_eq!(normalize_window_state(state), None);
    }

    #[test]
    fn clamps_desktop_window_state_size_to_safe_bounds() {
        let state = DesktopWindowState {
            x: 50.0,
            y: 80.0,
            width: 10.0,
            height: MAX_WINDOW_DIMENSION + 1.0,
            maximized: false,
        };

        assert!(!is_valid_window_state(&state));
        assert_eq!(
            normalize_window_state(state),
            Some(DesktopWindowState {
                width: MIN_WINDOW_WIDTH,
                height: MAX_WINDOW_DIMENSION,
                ..state
            })
        );
    }
}
