//! NekoGit desktop application core.
//! Wires together the Tauri shell, bundled server, system tray, menus, and local Git operations.

use std::{
    fs,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread,
    time::Duration,
};

use tauri::{Manager, Runtime, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};

mod desktop_autostart;
mod desktop_commands;
mod desktop_events;
mod desktop_github_cli;
mod desktop_instance;
mod desktop_menu;
mod desktop_menu_actions;
mod desktop_open;
mod desktop_runtime;
mod desktop_server;
mod desktop_session;
mod desktop_tray;
mod desktop_url;
mod desktop_window;
mod desktop_window_state;
mod local_repository;

use desktop_commands::*;
use desktop_instance::{
    claim_or_activate_instance, current_start_hidden, DesktopInstanceActivationHandlers,
    InstanceStartup,
};
use desktop_menu::{build_app_menu, DesktopNotificationMenu};
use desktop_menu_actions::handle_menu_event;
use desktop_runtime::{app_data_root_path, DesktopRuntime};
use desktop_server::{default_server_log_path, resolve_external_client_url, spawn_desktop_server};
use desktop_tray::{build_tray_icon, DesktopTrayHandlers};
use desktop_url::current_launch_target_url;
use desktop_window::{
    handle_navigation, handle_new_window_navigation, open_github_launch_url, show_main_window,
    DEFAULT_WINDOW_HEIGHT, DEFAULT_WINDOW_WIDTH, MAIN_WINDOW_LABEL,
};
use desktop_window_state::{
    save_window_state, DesktopWindowStateStore, MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH,
    WINDOW_STATE_FILE,
};

const DEFAULT_DEV_CLIENT_URL: &str = "http://127.0.0.1:3000";

const WINDOW_STATE_SAVE_DEBOUNCE: Duration = Duration::from_millis(400);

/// Saves window bounds after a short debounce so resize/move drags do not write on every event.
fn schedule_window_state_save<R: Runtime>(
    app_handle: tauri::AppHandle<R>,
    window: WebviewWindow<R>,
    pending: Arc<AtomicBool>,
) {
    if pending.swap(true, Ordering::SeqCst) {
        return;
    }

    thread::spawn(move || {
        thread::sleep(WINDOW_STATE_SAVE_DEBOUNCE);
        pending.store(false, Ordering::SeqCst);

        if let Some(store) = app_handle.try_state::<DesktopWindowStateStore>() {
            save_window_state(store.inner(), &window, None);
        }
    });
}

/// Builds and launches the Tauri application, initializing the bundled server,
/// system tray, app menu, window state, and all IPC command handlers.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let launch_url = current_launch_target_url();
            let start_hidden = current_start_hidden() && launch_url.is_none();
            let app_data_dir = app_data_root_path(app)?;
            let instance_handlers =
                DesktopInstanceActivationHandlers::new(show_main_window, open_github_launch_url);

            match claim_or_activate_instance(
                app,
                &app_data_dir,
                launch_url.as_deref(),
                start_hidden,
                instance_handlers,
            )? {
                InstanceStartup::Primary(instance) => {
                    app.manage(instance);
                }
                InstanceStartup::Secondary => {
                    app.handle().exit(0);
                    return Ok(());
                }
            }

            let webview_data_dir = app_data_dir.join("webview");
            let default_server_log_path = default_server_log_path(&app_data_dir);
            let default_user_settings_dir = app_data_dir.join("user-settings");
            let window_state_store =
                DesktopWindowStateStore::new(app_data_dir.join(WINDOW_STATE_FILE));
            let restored_window_state = window_state_store.current();
            app.manage(window_state_store);

            let mut server_entry = None;
            let mut node_binary = None;
            let mut server_log_path = default_server_log_path.clone();
            let mut user_settings_dir = default_user_settings_dir.clone();
            let mut bundled_server = false;
            let mut external_client = false;

            let client_url = if let Some(client_url) = resolve_external_client_url() {
                external_client = true;
                client_url
            } else if cfg!(debug_assertions) {
                DEFAULT_DEV_CLIENT_URL.to_owned()
            } else {
                let launch = spawn_desktop_server(app, &app_data_dir)?;
                bundled_server = true;
                server_entry = Some(launch.server_entry);
                node_binary = Some(launch.node_binary);
                server_log_path = launch.server_log_path;
                user_settings_dir = launch.user_settings_dir;
                let local_client_url = launch.client_url;
                app.manage(launch.server);
                local_client_url
            };
            let webview_url: Url = client_url
                .parse()
                .map_err(|error| format!("invalid NEKOGIT_CLIENT_URL `{client_url}`: {error}"))?;
            let navigation_app = app.handle().clone();
            let navigation_origin = webview_url.clone();
            let new_window_app = app.handle().clone();
            let new_window_origin = webview_url.clone();
            fs::create_dir_all(&webview_data_dir)
                .map_err(|error| format!("failed to create webview data directory: {error}"))?;
            app.manage(DesktopRuntime {
                client_url: client_url.clone(),
                app_data_dir,
                server_log_path,
                webview_data_dir: webview_data_dir.clone(),
                user_settings_dir,
                server_entry,
                node_binary,
                bundled_server,
                external_client,
            });
            let app_menu = build_app_menu(app).map_err(|error| error.to_string())?;
            app.manage(app_menu.navigation_menu);
            app.manage(app_menu.review_menu);
            app.manage(app_menu.current_github_menu);
            let tray_handlers = DesktopTrayHandlers::new(show_main_window);
            let (tray_mark_visible_read, tray_mark_all_read) = build_tray_icon(app, tray_handlers)?;
            app.manage(DesktopNotificationMenu {
                app_mark_visible_read: app_menu.mark_visible_notifications_read,
                app_mark_all_read: app_menu.mark_all_notifications_read,
                tray_mark_visible_read,
                tray_mark_all_read,
            });

            app.on_menu_event(|app, event| handle_menu_event(app, event.id().as_ref()));

            let mut window_builder = WebviewWindowBuilder::new(
                app,
                MAIN_WINDOW_LABEL,
                WebviewUrl::External(webview_url),
            )
            .title("NekoGit")
            .inner_size(
                restored_window_state
                    .map(|state| state.width)
                    .unwrap_or(DEFAULT_WINDOW_WIDTH),
                restored_window_state
                    .map(|state| state.height)
                    .unwrap_or(DEFAULT_WINDOW_HEIGHT),
            )
            .min_inner_size(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT)
            .resizable(true)
            .visible(!start_hidden)
            .data_directory(webview_data_dir)
            .enable_clipboard_access()
            .menu(app_menu.menu)
            .prevent_overflow()
            .on_navigation(move |url| handle_navigation(&navigation_app, &navigation_origin, url))
            .on_new_window(move |url, _features| {
                handle_new_window_navigation(&new_window_app, &new_window_origin, &url)
            });

            if let Some(state) = restored_window_state {
                window_builder = window_builder
                    .position(state.x, state.y)
                    .maximized(state.maximized);
            }

            let window = window_builder.build()?;

            if restored_window_state.is_none() {
                if let Some(store) = app.handle().try_state::<DesktopWindowStateStore>() {
                    save_window_state(store.inner(), &window, Some(false));
                }
            }

            let window_state_save_pending = Arc::new(AtomicBool::new(false));
            window.on_window_event({
                let window = window.clone();
                let app_handle = app.handle().clone();
                let window_state_save_pending = window_state_save_pending.clone();
                move |event| {
                    let store = app_handle.try_state::<DesktopWindowStateStore>();

                    match event {
                        WindowEvent::Moved(_)
                        | WindowEvent::Resized(_)
                        | WindowEvent::ScaleFactorChanged { .. }
                        | WindowEvent::Focused(false) => {
                            schedule_window_state_save(
                                app_handle.clone(),
                                window.clone(),
                                window_state_save_pending.clone(),
                            );
                        }
                        WindowEvent::CloseRequested { api, .. } => {
                            if let Some(store) = store {
                                save_window_state(store.inner(), &window, None);
                            }
                            api.prevent_close();
                            if let Err(error) = window.hide() {
                                eprintln!("failed to hide NekoGit window: {error}");
                            }
                        }
                        _ => {}
                    }
                }
            });

            if !start_hidden {
                window.set_focus()?;
            }

            if let Some(target_url) = launch_url {
                if let Err(error) = open_github_launch_url(app.handle(), &target_url) {
                    eprintln!("{error}");
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            desktop_autostart_status,
            desktop_runtime_info,
            desktop_diagnostics_report,
            desktop_open_app_data,
            desktop_server_status,
            desktop_open_server_log,
            desktop_open_github,
            desktop_open_github_url,
            desktop_clone_repository,
            desktop_remember_local_repository,
            desktop_local_repository_status,
            desktop_local_repository_git_status,
            desktop_local_repository_branches,
            desktop_local_repository_commit_history,
            desktop_local_repository_changed_files,
            desktop_local_repository_file_diff,
            desktop_local_repository_stashes,
            desktop_fetch_local_repository,
            desktop_pull_local_repository,
            desktop_push_local_repository,
            desktop_switch_local_repository_branch,
            desktop_create_local_repository_branch,
            desktop_checkout_remote_local_repository_branch,
            desktop_delete_local_repository_branch,
            desktop_commit_local_repository_changes,
            desktop_stash_local_repository_changes,
            desktop_pop_local_repository_stash,
            desktop_open_local_repository,
            desktop_open_local_repository_terminal,
            desktop_open_local_repository_path,
            desktop_read_github_cli_token,
            desktop_set_unread_count,
            desktop_set_window_title,
            desktop_set_navigation_state,
            desktop_set_review_state,
            desktop_set_current_github_state,
            desktop_set_autostart_enabled,
            desktop_show_window,
            desktop_restart_bundled_server
        ])
        .run(tauri::generate_context!())
        .expect("failed to run NekoGit desktop client");
}
