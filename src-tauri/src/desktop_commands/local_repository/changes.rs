//! Tauri commands for committing and stashing local repository changes.

use tauri::State;

use crate::{
    desktop_runtime::DesktopRuntime,
    local_repository::{
        commit_local_repository_changes, stash_local_repository_changes,
        DesktopLocalRepositoryGitStatus,
    },
};

/// Stages all changes and commits them with the given message.
#[tauri::command]
pub(crate) async fn desktop_commit_local_repository_changes(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
    commit_message: String,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let app_data_dir = runtime.app_data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        commit_local_repository_changes(&app_data_dir, &repository_url, &commit_message)
    })
    .await
    .map_err(|error| format!("failed to run git commit task: {error}"))?
}

#[tauri::command]
/// Stashes all current changes (including untracked files).
pub(crate) async fn desktop_stash_local_repository_changes(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let app_data_dir = runtime.app_data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        stash_local_repository_changes(&app_data_dir, &repository_url)
    })
    .await
    .map_err(|error| format!("failed to run git stash task: {error}"))?
}
