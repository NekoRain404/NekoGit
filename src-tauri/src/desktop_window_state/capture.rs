use tauri::{Manager, Runtime, WebviewWindow};

use super::{
    store::DesktopWindowStateStore, validation::normalize_window_state, DesktopWindowState,
};

fn window_scale_factor<R: Runtime>(window: &WebviewWindow<R>) -> f64 {
    match window.scale_factor() {
        Ok(scale_factor) if scale_factor.is_finite() && scale_factor > 0.0 => scale_factor,
        _ => 1.0,
    }
}

fn capture_window_state<R: Runtime>(
    window: &WebviewWindow<R>,
    fallback_state: Option<DesktopWindowState>,
    maximized_override: Option<bool>,
) -> Option<DesktopWindowState> {
    let scale_factor = window_scale_factor(window);
    let maximized = maximized_override.unwrap_or_else(|| window.is_maximized().unwrap_or(false));

    if maximized {
        if let Some(fallback_state) = fallback_state {
            return normalize_window_state(DesktopWindowState {
                maximized,
                ..fallback_state
            });
        }
    }

    let position = window.outer_position().ok()?;
    let size = window.inner_size().ok()?;

    normalize_window_state(DesktopWindowState {
        x: f64::from(position.x) / scale_factor,
        y: f64::from(position.y) / scale_factor,
        width: f64::from(size.width) / scale_factor,
        height: f64::from(size.height) / scale_factor,
        maximized,
    })
}

pub(crate) fn save_window_state<R: Runtime>(
    store: &DesktopWindowStateStore,
    window: &WebviewWindow<R>,
    maximized_override: Option<bool>,
) {
    let fallback_state = store.current();
    if let Some(state) = capture_window_state(window, fallback_state, maximized_override) {
        if let Err(error) = store.update(state) {
            eprintln!("{error}");
        }
    }
}

pub(crate) fn save_main_window_state<R: Runtime>(
    app: &tauri::AppHandle<R>,
    main_window_label: &str,
) {
    let Some(store) = app.try_state::<DesktopWindowStateStore>() else {
        return;
    };
    let Some(window) = app.get_webview_window(main_window_label) else {
        return;
    };

    save_window_state(store.inner(), &window, None);
}
