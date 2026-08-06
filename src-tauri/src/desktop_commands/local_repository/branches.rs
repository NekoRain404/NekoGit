//! Tauri commands for local repository branch operations (switch, create, checkout).

use tauri::State;

use crate::{
    desktop_runtime::DesktopRuntime,
    local_repository::{
        checkout_remote_local_repository_branch, create_local_repository_branch,
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
