//! Type definitions for Desktop runtime environment.

use std::{env, path::PathBuf};

use serde::Serialize;

use crate::desktop_server::DesktopServerStatus;

use super::paths::path_to_display_string;

pub(crate) struct DesktopRuntime {
    pub(crate) client_url: String,
    pub(crate) app_data_dir: PathBuf,
    pub(crate) server_log_path: PathBuf,
    pub(crate) webview_data_dir: PathBuf,
    pub(crate) user_settings_dir: PathBuf,
    pub(crate) server_entry: Option<PathBuf>,
    pub(crate) node_binary: Option<PathBuf>,
    pub(crate) bundled_server: bool,
    pub(crate) external_client: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopRuntimeInfo {
    pub(super) product_name: &'static str,
    pub(super) version: &'static str,
    pub(super) platform: &'static str,
    pub(super) client_url: String,
    pub(super) app_data_dir: String,
    pub(super) server_log_path: String,
    pub(super) webview_data_dir: String,
    pub(super) user_settings_dir: String,
    pub(super) server_entry: Option<String>,
    pub(super) node_binary: Option<String>,
    pub(super) bundled_server: bool,
    pub(super) external_client: bool,
    pub(super) debug_build: bool,
}

impl DesktopRuntime {
    /// Logs an info message.
    pub(crate) fn info(&self) -> DesktopRuntimeInfo {
        DesktopRuntimeInfo {
            product_name: "NekoGit",
            version: env!("CARGO_PKG_VERSION"),
            platform: env::consts::OS,
            client_url: self.client_url.clone(),
            app_data_dir: path_to_display_string(&self.app_data_dir),
            server_log_path: path_to_display_string(&self.server_log_path),
            webview_data_dir: path_to_display_string(&self.webview_data_dir),
            user_settings_dir: path_to_display_string(&self.user_settings_dir),
            server_entry: self.server_entry.as_deref().map(path_to_display_string),
            node_binary: self.node_binary.as_deref().map(path_to_display_string),
            bundled_server: self.bundled_server,
            external_client: self.external_client,
            debug_build: cfg!(debug_assertions),
        }
    }

    /// Unmanaged server status.
    pub(crate) fn unmanaged_server_status(&self) -> DesktopServerStatus {
        DesktopServerStatus {
            bundled_server: false,
            running: false,
            pid: None,
            port: None,
            address: None,
            client_url: Some(self.client_url.clone()),
            log_path: path_to_display_string(&self.server_log_path),
            last_exit_status: None,
        }
    }
}
