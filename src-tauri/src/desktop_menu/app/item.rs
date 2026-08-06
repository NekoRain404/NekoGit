//! Shared helpers for constructing application menu items.

use tauri::{menu::MenuItem, Manager, Runtime};

use crate::desktop_menu::accelerators::desktop_app_menu_accelerator;

/// Creates a `MenuItem` with the matching keyboard accelerator, if any.
pub(super) fn app_menu_item<R: Runtime, M: Manager<R>>(
    manager: &M,
    id: &'static str,
    text: &str,
    enabled: bool,
) -> tauri::Result<MenuItem<R>> {
    MenuItem::with_id(manager, id, text, enabled, desktop_app_menu_accelerator(id))
}
