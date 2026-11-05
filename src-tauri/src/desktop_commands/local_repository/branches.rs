//! Tauri commands for local repository branch operations (switch, create, checkout, rebase).

use tauri::State;

use crate::{
    desktop_runtime::DesktopRuntime,
    local_repository::{
        abort_local_repository_rebase, checkout_remote_local_repository_branch,
        create_local_repository_branch, delete_local_repository_branch, rebase_local_repository,
        switch_local_repository_branch, DesktopLocalRepositoryGitStatus,
    },
};

/// Switches to a local branch and returns the updated git status.
#[tauri::command]
pub(crate) async fn desktop_switch_local_repository_branch(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
    branch_name: String,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let app_data_dir = runtime.app_data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        switch_local_repository_branch(&app_data_dir, &repository_url, &branch_name)
    })
    .await
    .map_err(|error| format!("failed to run git switch task: {error}"))?
}

#[tauri::command]
/// Creates a new local branch and switches to it.
pub(crate) async fn desktop_create_local_repository_branch(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
    branch_name: String,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let app_data_dir = runtime.app_data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        create_local_repository_branch(&app_data_dir, &repository_url, &branch_name)
    })
    .await
    .map_err(|error| format!("failed to run git branch create task: {error}"))?
}

#[tauri::command]
/// Checks out a remote branch as a new local tracking branch.
pub(crate) async fn desktop_checkout_remote_local_repository_branch(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
    remote_branch_name: String,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let app_data_dir = runtime.app_data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        checkout_remote_local_repository_branch(&app_data_dir, &repository_url, &remote_branch_name)
    })
    .await
    .map_err(|error| format!("failed to run git remote checkout task: {error}"))?
}

#[tauri::command]
/// Deletes a local branch (safe delete) and returns the updated git status.
pub(crate) async fn desktop_delete_local_repository_branch(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
    branch_name: String,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let app_data_dir = runtime.app_data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        delete_local_repository_branch(&app_data_dir, &repository_url, &branch_name)
    })
    .await
    .map_err(|error| format!("failed to run git branch delete task: {error}"))?
}

#[tauri::command]
/// Rebases the current branch onto `target_branch`, or onto its upstream when omitted.
pub(crate) async fn desktop_rebase_local_repository(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
    target_branch: Option<String>,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let app_data_dir = runtime.app_data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        rebase_local_repository(&app_data_dir, &repository_url, target_branch.as_deref())
    })
    .await
    .map_err(|error| format!("failed to run git rebase task: {error}"))?
}

#[tauri::command]
/// Aborts an in-progress rebase and returns the restored git status.
pub(crate) async fn desktop_abort_local_repository_rebase(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let app_data_dir = runtime.app_data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        abort_local_repository_rebase(&app_data_dir, &repository_url)
    })
    .await
    .map_err(|error| format!("failed to run git rebase abort task: {error}"))?
}
