//! Tauri commands for reading local repository state (status, branches, history, diffs).

use tauri::State;

use crate::{
    desktop_runtime::DesktopRuntime,
    local_repository::{
        local_repository_branches, local_repository_changed_files, local_repository_commit_history,
        local_repository_file_diff, local_repository_git_status, local_repository_status,
        DesktopLocalRepositoryBranches, DesktopLocalRepositoryChangedFiles,
        DesktopLocalRepositoryCommitHistory, DesktopLocalRepositoryFileDiff,
        DesktopLocalRepositoryGitStatus, DesktopLocalRepositoryStatus,
    },
};

#[tauri::command]
/// Returns whether a local clone exists for the given repository URL.
pub(crate) fn desktop_local_repository_status(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
) -> Result<DesktopLocalRepositoryStatus, String> {
    local_repository_status(&runtime.app_data_dir, &repository_url)
}

#[tauri::command]
/// Returns branch, ahead/behind counts, and file change summary.
pub(crate) async fn desktop_local_repository_git_status(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let app_data_dir = runtime.app_data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        local_repository_git_status(&app_data_dir, &repository_url)
    })
    .await
    .map_err(|error| format!("failed to run git status task: {error}"))?
}

#[tauri::command]
/// Lists local and remote branches for the repository.
pub(crate) async fn desktop_local_repository_branches(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
) -> Result<DesktopLocalRepositoryBranches, String> {
    let app_data_dir = runtime.app_data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        local_repository_branches(&app_data_dir, &repository_url)
    })
    .await
    .map_err(|error| format!("failed to run git branch task: {error}"))?
}

#[tauri::command]
/// Returns the most recent commits from the repository log.
pub(crate) async fn desktop_local_repository_commit_history(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
    limit: u32,
) -> Result<DesktopLocalRepositoryCommitHistory, String> {
    let app_data_dir = runtime.app_data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        local_repository_commit_history(&app_data_dir, &repository_url, limit)
    })
    .await
    .map_err(|error| format!("failed to run git log task: {error}"))?
}

#[tauri::command]
/// Lists changed files with their staging/unstaging status.
pub(crate) async fn desktop_local_repository_changed_files(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
    limit: u32,
) -> Result<DesktopLocalRepositoryChangedFiles, String> {
    let app_data_dir = runtime.app_data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        local_repository_changed_files(&app_data_dir, &repository_url, limit)
    })
    .await
    .map_err(|error| format!("failed to run git status task: {error}"))?
}

#[tauri::command]
/// Returns the staged, unstaged, and untracked diff for a single file.
pub(crate) async fn desktop_local_repository_file_diff(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
    relative_path: String,
    previous_path: Option<String>,
    max_bytes: u32,
) -> Result<DesktopLocalRepositoryFileDiff, String> {
    let app_data_dir = runtime.app_data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        local_repository_file_diff(
            &app_data_dir,
            &repository_url,
            &relative_path,
            previous_path,
            max_bytes,
        )
    })
    .await
    .map_err(|error| format!("failed to run git diff task: {error}"))?
}
