//! Tauri commands for synchronizing local repositories with their remotes (fetch, pull, push).

use tauri::State;

use crate::{
    desktop_runtime::DesktopRuntime,
    local_repository::{
        fetch_local_repository, pull_local_repository, push_local_repository,
        DesktopLocalRepositoryGitStatus,
    },
};

/// Fetches and prunes remote refs without modifying the working tree.
#[tauri::command]
pub(crate) async fn desktop_fetch_local_repository(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let app_data_dir = runtime.app_data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        fetch_local_repository(&app_data_dir, &repository_url)
    })
    .await
    .map_err(|error| format!("failed to run git fetch task: {error}"))?
}

#[tauri::command]
/// Pulls the current branch with fast-forward only.
pub(crate) async fn desktop_pull_local_repository(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let app_data_dir = runtime.app_data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        pull_local_repository(&app_data_dir, &repository_url)
    })
    .await
    .map_err(|error| format!("failed to run git pull task: {error}"))?
}

#[tauri::command]
/// Pushes the current branch to its upstream (or sets upstream on first push).
pub(crate) async fn desktop_push_local_repository(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let app_data_dir = runtime.app_data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        push_local_repository(&app_data_dir, &repository_url)
    })
    .await
    .map_err(|error| format!("failed to run git push task: {error}"))?
}
