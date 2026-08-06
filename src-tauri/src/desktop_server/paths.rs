//! Resolves bundled server paths and external client URLs.

use std::{
    env, fs,
    fs::OpenOptions,
    net::TcpListener,
    path::{Path, PathBuf},
};

use tauri::Manager;

use super::{LOCAL_SERVER_HOST, NODE_RUNTIME_BINARY, SERVER_LOG_FILE};

/// Resolves the value or path.
pub(crate) fn resolve_external_client_url() -> Option<String> {
    env::var("NEKOGIT_CLIENT_URL")
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| value.starts_with("http://") || value.starts_with("https://"))
}

/// Returns the default path for the bundled server log file.
pub(crate) fn default_server_log_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(SERVER_LOG_FILE)
}

/// Creates the server log directory and file if they do not exist.
pub(crate) fn ensure_server_log_file(path: &Path) -> Result<PathBuf, String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create NekoGit server log directory: {error}"))?;
    }

    OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|error| format!("failed to create NekoGit server log: {error}"))?;

    Ok(path.to_path_buf())
}

pub(super) fn path_to_display_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn executable_dir() -> Option<PathBuf> {
    env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf))
}

pub(super) fn bundled_server_entry(app: &tauri::App) -> Result<PathBuf, String> {
    let mut candidates = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join(".output/server/index.mjs"));
    }

    if let Some(executable_dir) = executable_dir() {
        candidates.push(executable_dir.join(".output/server/index.mjs"));
    }

    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.output/server/index.mjs"));

    candidates
        .into_iter()
        .find(|candidate| candidate.is_file())
        .ok_or_else(|| {
            "NekoGit desktop server was not found. Run `pnpm exec nuxt build` before launching the release client.".to_owned()
        })
}

pub(super) fn bundled_node_binary(app: &tauri::App) -> PathBuf {
    if let Ok(node_path) = env::var("NEKOGIT_NODE_PATH") {
        let node_path = node_path.trim();
        if !node_path.is_empty() {
            return PathBuf::from(node_path);
        }
    }

    let mut candidates = Vec::new();
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join(NODE_RUNTIME_BINARY));
    }
    if let Some(executable_dir) = executable_dir() {
        candidates.push(executable_dir.join(NODE_RUNTIME_BINARY));
    }
    candidates
        .push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(format!("../{NODE_RUNTIME_BINARY}")));

    candidates
        .into_iter()
        .find(|candidate| candidate.is_file())
        .unwrap_or_else(|| PathBuf::from("node"))
}

pub(super) fn reserve_local_port() -> Result<u16, String> {
    TcpListener::bind((LOCAL_SERVER_HOST, 0))
        .map_err(|error| format!("failed to reserve local server port: {error}"))?
        .local_addr()
        .map(|address| address.port())
        .map_err(|error| format!("failed to read local server port: {error}"))
}

pub(super) fn bundled_server_address(port: u16) -> String {
    format!("{LOCAL_SERVER_HOST}:{port}")
}

pub(super) fn bundled_server_client_url(port: u16) -> String {
    format!("http://{}", bundled_server_address(port))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_bundled_server_address_and_client_url() {
        assert_eq!(bundled_server_address(43210), "127.0.0.1:43210");
        assert_eq!(bundled_server_client_url(43210), "http://127.0.0.1:43210");
    }
}
