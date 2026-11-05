//! Tauri command for adopting an existing local clone of a GitHub repository.

use std::path::Path;

use tauri::State;

use crate::{
    desktop_runtime::DesktopRuntime,
    local_repository::{remember_existing_local_repository, DesktopLocalRepositoryStatus},
};

/// Associates an existing local Git clone with the current GitHub repository.
#[tauri::command]
pub(crate) async fn desktop_remember_local_repository(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
    directory: String,
) -> Result<DesktopLocalRepositoryStatus, String> {
    let app_data_dir = runtime.app_data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        remember_existing_local_repository(&app_data_dir, &repository_url, Path::new(&directory))
    })
    .await
    .map_err(|error| format!("failed to run local repository adoption task: {error}"))?
}
