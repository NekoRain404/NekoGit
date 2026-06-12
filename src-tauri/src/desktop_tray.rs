//! System tray integration.

use tauri::{
    menu::MenuItem,
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime,
};

use crate::desktop_menu::build_tray_menu;

const TRAY_ID: &str = "nekogit.tray";
const MAX_DESKTOP_UNREAD_COUNT: u32 = 99_999;

pub(crate) struct DesktopTrayHandlers<R: Runtime> {
    show_window: fn(&tauri::AppHandle<R>) -> Result<(), String>,
}

impl<R: Runtime> Clone for DesktopTrayHandlers<R> {
    fn clone(&self) -> Self {
        *self
    }
}

impl<R: Runtime> Copy for DesktopTrayHandlers<R> {}

impl<R: Runtime> DesktopTrayHandlers<R> {
    pub(crate) const fn new(show_window: fn(&tauri::AppHandle<R>) -> Result<(), String>) -> Self {
        Self { show_window }
    }
}

fn tray_tooltip_for_unread_count(count: u32) -> String {
    if count == 0 {
        "NekoGit".to_owned()
    } else if count == 1 {
        "NekoGit - 1 unread notification".to_owned()
    } else {
        format!("NekoGit - {count} unread notifications")
    }
}

/// Normalizes the input.
pub(crate) fn normalize_desktop_unread_count(count: u32) -> u32 {
    count.min(MAX_DESKTOP_UNREAD_COUNT)
}

fn handle_tray_icon_event<R: Runtime>(
    app: &tauri::AppHandle<R>,
    event: &TrayIconEvent,
    handlers: DesktopTrayHandlers<R>,
) {
    match event {
        TrayIconEvent::Click {
            button: MouseButton::Left,
            ..
        }
        | TrayIconEvent::DoubleClick {
            button: MouseButton::Left,
            ..
        } => {
            if let Err(error) = (handlers.show_window)(app) {
                eprintln!("{error}");
            }
        }
        _ => {}
    }
}

/// Builds the final value.
pub(crate) fn build_tray_icon<R: Runtime>(
    app: &tauri::App<R>,
    handlers: DesktopTrayHandlers<R>,
) -> Result<(MenuItem<R>, MenuItem<R>), String> {
    let (tray_menu, mark_visible_notifications_read, mark_all_notifications_read) =
        build_tray_menu(app).map_err(|error| error.to_string())?;
    let app_handle = app.app_handle().clone();
    let mut tray_builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&tray_menu)
        .show_menu_on_left_click(false)
        .tooltip("NekoGit");

    if let Some(icon) = app.default_window_icon() {
        tray_builder = tray_builder.icon(icon.clone());
    }

    tray_builder
        .on_tray_icon_event(move |_tray, event| {
            handle_tray_icon_event(&app_handle, &event, handlers)
        })
        .build(app)
        .map_err(|error| format!("failed to create NekoGit tray icon: {error}"))?;

    Ok((mark_visible_notifications_read, mark_all_notifications_read))
}

/// Updates the resource.
pub(crate) fn update_desktop_unread_count<R: Runtime>(
    app: &tauri::AppHandle<R>,
    main_window_label: &str,
    count: u32,
) -> Result<u32, String> {
    let count = normalize_desktop_unread_count(count);

    if let Some(window) = app.get_webview_window(main_window_label) {
        window
            .set_badge_count((count > 0).then_some(i64::from(count)))
            .map_err(|error| format!("failed to update NekoGit window badge: {error}"))?;
    }

    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let tooltip = tray_tooltip_for_unread_count(count);
        tray.set_tooltip(Some(tooltip))
            .map_err(|error| format!("failed to update NekoGit tray tooltip: {error}"))?;
    }

    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_tray_tooltips_for_unread_counts() {
        assert_eq!(tray_tooltip_for_unread_count(0), "NekoGit");
        assert_eq!(
            tray_tooltip_for_unread_count(1),
            "NekoGit - 1 unread notification"
        );
        assert_eq!(
            tray_tooltip_for_unread_count(42),
            "NekoGit - 42 unread notifications"
        );
    }

    #[test]
    fn caps_desktop_unread_count_for_badges() {
        assert_eq!(normalize_desktop_unread_count(0), 0);
        assert_eq!(normalize_desktop_unread_count(99_999), 99_999);
        assert_eq!(normalize_desktop_unread_count(100_000), 99_999);
    }
}
