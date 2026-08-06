//! Tauri commands for opening local repository folders and terminals.

use std::path::Path;

use tauri::State;

use crate::{
    desktop_open::{open_path, open_terminal_at_path},
    desktop_runtime::DesktopRuntime,
    local_repository::{
        local_repository_path_status, local_repository_status, DesktopLocalRepositoryPathStatus,
        DesktopLocalRepositoryStatus,
    },
};

#[tauri::command]
/// Opens the local repository directory in the system file manager.
pub(crate) fn desktop_open_local_repository(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
) -> Result<DesktopLocalRepositoryStatus, String> {
    let status = local_repository_status(&runtime.app_data_dir, &repository_url)?;
    let Some(path) = status.path.as_deref() else {
        return Err("local repository is not available".to_owned());
    };

    open_path(Path::new(path))?;
    Ok(status)
}

#[tauri::command]
/// Opens a terminal at the local repository directory.
pub(crate) fn desktop_open_local_repository_terminal(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
) -> Result<DesktopLocalRepositoryStatus, String> {
    let status = local_repository_status(&runtime.app_data_dir, &repository_url)?;
    let Some(path) = status.path.as_deref() else {
        return Err("local repository is not available".to_owned());
    };

    open_terminal_at_path(Path::new(path))?;
    Ok(status)
}

#[tauri::command]
/// Opens a specific file or directory inside the local repository.
pub(crate) fn desktop_open_local_repository_path(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
    relative_path: String,
) -> Result<DesktopLocalRepositoryPathStatus, String> {
    let status =
        local_repository_path_status(&runtime.app_data_dir, &repository_url, &relative_path)?;
    let Some(path) = status.path.as_deref() else {
        return Err("local repository path is not available".to_owned());
    };

    open_path(Path::new(path))?;
    Ok(status)
}
