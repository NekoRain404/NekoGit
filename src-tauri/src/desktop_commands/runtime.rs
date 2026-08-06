//! Tauri commands exposing desktop runtime diagnostics, server management, and autostart control.

use std::sync::Arc;

use tauri::{Manager, Runtime, State};

use crate::{
    desktop_autostart::{
        read_desktop_autostart_status, set_desktop_autostart_enabled, DesktopAutostartStatus,
    },
    desktop_open::open_path,
    desktop_runtime::{
        format_desktop_diagnostics_report, DesktopDiagnostics, DesktopRuntime, DesktopRuntimeInfo,
    },
    desktop_server::{ensure_server_log_file, DesktopServer, DesktopServerStatus},
};

#[tauri::command]
/// Returns runtime metadata (version, paths, platform) for the frontend.
pub(crate) fn desktop_runtime_info(runtime: State<'_, DesktopRuntime>) -> DesktopRuntimeInfo {
    runtime.info()
}

#[tauri::command]
/// Returns the current status of the bundled server process.
pub(crate) fn desktop_server_status<R: Runtime>(
    app: tauri::AppHandle<R>,
    runtime: State<'_, DesktopRuntime>,
) -> Result<DesktopServerStatus, String> {
    if let Some(server) = app.try_state::<Arc<DesktopServer>>() {
        return server.status();
    }

    Ok(runtime.unmanaged_server_status())
}

#[tauri::command]
/// Generates a human-readable diagnostics report for troubleshooting.
pub(crate) fn desktop_diagnostics_report<R: Runtime>(
    app: tauri::AppHandle<R>,
    runtime: State<'_, DesktopRuntime>,
) -> Result<String, String> {
    let server_status = if let Some(server) = app.try_state::<Arc<DesktopServer>>() {
        server.status()?
    } else {
        runtime.unmanaged_server_status()
    };

    Ok(format_desktop_diagnostics_report(&DesktopDiagnostics {
        runtime: runtime.info(),
        server_status,
        autostart_status: read_desktop_autostart_status(),
    }))
}

#[tauri::command]
/// Returns whether autostart is supported and currently enabled.
pub(crate) fn desktop_autostart_status() -> DesktopAutostartStatus {
    read_desktop_autostart_status()
}

#[tauri::command]
/// Toggles the desktop autostart configuration on or off.
pub(crate) fn desktop_set_autostart_enabled(
    enabled: bool,
) -> Result<DesktopAutostartStatus, String> {
    set_desktop_autostart_enabled(enabled)
}

#[tauri::command]
/// Opens the application data directory in the system file manager.
pub(crate) fn desktop_open_app_data(runtime: State<'_, DesktopRuntime>) -> Result<(), String> {
    open_path(&runtime.app_data_dir)
}

#[tauri::command]
/// Opens the bundled server log file in the system file manager.
pub(crate) fn desktop_open_server_log(runtime: State<'_, DesktopRuntime>) -> Result<(), String> {
    ensure_server_log_file(&runtime.server_log_path).and_then(|path| open_path(&path))
}
