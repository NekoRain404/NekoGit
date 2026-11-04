//! Tauri commands for committing and stashing local repository changes.

use tauri::State;

use crate::{
    desktop_runtime::DesktopRuntime,
    local_repository::{
        apply_local_repository_stash, clear_local_repository_stashes,
        commit_local_repository_changes, pop_local_repository_stash, request_git_cancellation,
        stage_local_repository_path, stash_local_repository_changes, unstage_local_repository_path,
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

#[tauri::command]
/// Applies and removes a stash entry, returning the updated git status.
pub(crate) async fn desktop_pop_local_repository_stash(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
    index: u32,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let app_data_dir = runtime.app_data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        pop_local_repository_stash(&app_data_dir, &repository_url, index)
    })
    .await
    .map_err(|error| format!("failed to run git stash pop task: {error}"))?
}

#[tauri::command]
/// Applies a stash entry by index without removing it, returning the updated git status.
pub(crate) async fn desktop_apply_local_repository_stash(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
    index: u32,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let app_data_dir = runtime.app_data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        apply_local_repository_stash(&app_data_dir, &repository_url, index)
    })
    .await
    .map_err(|error| format!("failed to run git stash apply task: {error}"))?
}

#[tauri::command]
/// Clears all stash entries, returning the updated git status.
pub(crate) async fn desktop_clear_local_repository_stashes(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let app_data_dir = runtime.app_data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        clear_local_repository_stashes(&app_data_dir, &repository_url)
    })
    .await
    .map_err(|error| format!("failed to run git stash clear task: {error}"))?
}

/// Stages a single file or directory inside a local repository.
#[tauri::command]
pub(crate) async fn desktop_stage_local_repository_path(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
    relative_path: String,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let app_data_dir = runtime.app_data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        stage_local_repository_path(&app_data_dir, &repository_url, &relative_path)
    })
    .await
    .map_err(|error| format!("failed to run git add task: {error}"))?
}

/// Unstages a single file or directory inside a local repository.
#[tauri::command]
pub(crate) async fn desktop_unstage_local_repository_path(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
    relative_path: String,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let app_data_dir = runtime.app_data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        unstage_local_repository_path(&app_data_dir, &repository_url, &relative_path)
    })
    .await
    .map_err(|error| format!("failed to run git restore --staged task: {error}"))?
}

/// Requests cancellation of the currently running local Git network operation.
#[tauri::command]
pub(crate) fn desktop_cancel_local_repository_operation() -> Result<(), String> {
    request_git_cancellation();
    Ok(())
}
