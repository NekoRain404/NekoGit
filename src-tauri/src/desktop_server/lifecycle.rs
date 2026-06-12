//! Server lifecycle management for Desktop server management.

use std::{
    path::Path,
    sync::{atomic::AtomicBool, Arc, Mutex},
};

use tauri::{Manager, Runtime};

use crate::desktop_session::{resolve_session_password, SESSION_SECRET_FILE};

use super::{
    config::create_desktop_server_config,
    log::open_server_log,
    paths::{
        bundled_node_binary, bundled_server_client_url, bundled_server_entry, reserve_local_port,
    },
    process::{
        restart_desktop_server_child, spawn_desktop_server_child, start_desktop_server_monitor,
        wait_for_desktop_server_startup,
    },
    types::{DesktopServer, DesktopServerLaunch},
};

/// Restart bundled desktop server.
pub(crate) fn restart_bundled_desktop_server<R: Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<(), String> {
    let Some(server) = app.try_state::<Arc<DesktopServer>>() else {
        return Err("bundled NekoGit server is not active for this runtime".to_owned());
    };

    restart_desktop_server_child(server.inner())
}

/// Spawn desktop server.
pub(crate) fn spawn_desktop_server(
    app: &tauri::App,
    app_data_dir: &Path,
) -> Result<DesktopServerLaunch, String> {
    let server_entry = bundled_server_entry(app)?;
    let port = reserve_local_port()?;
    let user_settings_dir = app_data_dir.join("user-settings");
    let node_binary = bundled_node_binary(app);
    let (server_log_path, _, _) = open_server_log(app_data_dir)?;
    let session_password = resolve_session_password(&app_data_dir.join(SESSION_SECRET_FILE))?;
    let config = create_desktop_server_config(
        server_entry.clone(),
        node_binary.clone(),
        server_log_path.clone(),
        user_settings_dir.clone(),
        session_password,
    )?;
    let mut child = spawn_desktop_server_child(&config, port, true)?;
    wait_for_desktop_server_startup(&mut child, port, &server_log_path)?;

    let server = Arc::new(DesktopServer {
        config,
        port,
        child: Mutex::new(child),
        last_exit_status: Mutex::new(None),
        shutting_down: AtomicBool::new(false),
    });
    start_desktop_server_monitor(&server)?;

    Ok(DesktopServerLaunch {
        client_url: bundled_server_client_url(port),
        server,
        server_entry,
        node_binary,
        server_log_path,
        user_settings_dir,
    })
}
