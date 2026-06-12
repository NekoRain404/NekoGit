//! Bundled Nuxt/Nitro server lifecycle for the desktop build.

use std::time::Duration;

mod config;
mod lifecycle;
mod log;
mod paths;
mod process;
mod types;

const LOCAL_SERVER_HOST: &str = "127.0.0.1";
const LOCAL_SERVER_STARTUP_ATTEMPTS: usize = 120;
const LOCAL_SERVER_STARTUP_INTERVAL: Duration = Duration::from_millis(100);
const LOCAL_SERVER_MONITOR_INTERVAL: Duration = Duration::from_secs(2);
const LOCAL_SERVER_RESTART_BACKOFF: Duration = Duration::from_secs(5);
const NODE_RUNTIME_BINARY: &str = ".node-runtime/linux-x64/bin/node";
const SERVER_LOG_FILE: &str = "logs/nekogit-server.log";

pub(crate) use lifecycle::{restart_bundled_desktop_server, spawn_desktop_server};
pub(crate) use paths::{
    default_server_log_path, ensure_server_log_file, resolve_external_client_url,
};
pub(crate) use types::{DesktopServer, DesktopServerStatus};
