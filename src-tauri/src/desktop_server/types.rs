use std::{
    path::PathBuf,
    process::Child,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
};

use serde::Serialize;

use super::paths::{bundled_server_address, bundled_server_client_url, path_to_display_string};

#[derive(Clone)]
pub(super) struct DesktopServerConfig {
    pub(super) server_entry: PathBuf,
    pub(super) server_dir: PathBuf,
    pub(super) node_binary: PathBuf,
    pub(super) server_log_path: PathBuf,
    pub(super) session_password: String,
    pub(super) personal_mode_enabled: String,
    pub(super) token_enabled: String,
    pub(super) oauth_requested: bool,
    pub(super) oauth_env_ready: bool,
    pub(super) oauth_enabled: bool,
    pub(super) user_settings_storage_driver: String,
    pub(super) user_settings_storage_base: String,
}

pub(crate) struct DesktopServer {
    pub(super) config: DesktopServerConfig,
    pub(super) port: u16,
    pub(super) child: Mutex<Child>,
    pub(super) last_exit_status: Mutex<Option<String>>,
    pub(super) shutting_down: AtomicBool,
}

impl Drop for DesktopServer {
    fn drop(&mut self) {
        self.shutting_down.store(true, Ordering::SeqCst);
        if let Ok(mut child) = self.child.lock() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

impl DesktopServer {
    pub(crate) fn status(&self) -> Result<DesktopServerStatus, String> {
        let mut child = self
            .child
            .lock()
            .map_err(|_| "failed to lock bundled NekoGit server process".to_owned())?;
        let exit_status = child
            .try_wait()
            .map_err(|error| format!("failed to inspect bundled NekoGit server: {error}"))?;
        let mut last_exit_status = self
            .last_exit_status
            .lock()
            .map_err(|_| "failed to lock bundled NekoGit server status".to_owned())?;

        if let Some(status) = exit_status {
            *last_exit_status = Some(status.to_string());
        }

        let running = exit_status.is_none();

        Ok(DesktopServerStatus {
            bundled_server: true,
            running,
            pid: running.then(|| child.id()),
            port: Some(self.port),
            address: Some(bundled_server_address(self.port)),
            client_url: Some(bundled_server_client_url(self.port)),
            log_path: path_to_display_string(&self.config.server_log_path),
            last_exit_status: last_exit_status.clone(),
        })
    }
}

pub(crate) struct DesktopServerLaunch {
    pub(crate) client_url: String,
    pub(crate) server: std::sync::Arc<DesktopServer>,
    pub(crate) server_entry: PathBuf,
    pub(crate) node_binary: PathBuf,
    pub(crate) server_log_path: PathBuf,
    pub(crate) user_settings_dir: PathBuf,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopServerStatus {
    pub(crate) bundled_server: bool,
    pub(crate) running: bool,
    pub(crate) pid: Option<u32>,
    pub(crate) port: Option<u16>,
    pub(crate) address: Option<String>,
    pub(crate) client_url: Option<String>,
    pub(crate) log_path: String,
    pub(crate) last_exit_status: Option<String>,
}
