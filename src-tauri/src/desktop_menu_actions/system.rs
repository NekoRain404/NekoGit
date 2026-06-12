use tauri::{Manager, Runtime, Url};

use crate::{
    desktop_menu::{
        MENU_OPEN_APP_DATA, MENU_OPEN_GITHUB, MENU_OPEN_SERVER_LOG, MENU_RESTART_SERVER,
    },
    desktop_open::{open_external_url, open_path},
    desktop_runtime::{app_data_root_path, DesktopRuntime},
    desktop_server::{
        default_server_log_path, ensure_server_log_file, restart_bundled_desktop_server,
    },
    desktop_window::MAIN_WINDOW_LABEL,
};

pub(super) fn handle_system_menu_event<R: Runtime>(
    app: &tauri::AppHandle<R>,
    item_id: &str,
) -> bool {
    match item_id {
        MENU_OPEN_APP_DATA => {
            if let Err(error) = app_data_root_path(app).and_then(|path| open_path(&path)) {
                eprintln!("{error}");
            }
        }
        MENU_OPEN_SERVER_LOG => {
            let result = app
                .try_state::<DesktopRuntime>()
                .map(|runtime| runtime.server_log_path.clone())
                .or_else(|| {
                    app_data_root_path(app)
                        .ok()
                        .map(|path| default_server_log_path(&path))
                })
                .ok_or_else(|| "desktop runtime is not ready yet".to_owned())
                .and_then(|path| ensure_server_log_file(&path))
                .and_then(|path| open_path(&path));

            if let Err(error) = result {
                eprintln!("{error}");
            }
        }
        MENU_RESTART_SERVER => {
            if let Err(error) = restart_bundled_desktop_server(app) {
                eprintln!("{error}");
            } else if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                if let Err(error) = window.reload() {
                    eprintln!("failed to reload NekoGit window: {error}");
                }
            }
        }
        MENU_OPEN_GITHUB => match "https://github.com".parse::<Url>() {
            Ok(url) => {
                if let Err(error) = open_external_url(&url) {
                    eprintln!("{error}");
                }
            }
            Err(error) => eprintln!("failed to parse NekoGit GitHub URL: {error}"),
        },
        _ => return false,
    }

    true
}
