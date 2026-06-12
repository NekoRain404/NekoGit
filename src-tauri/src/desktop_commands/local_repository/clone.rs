use std::path::Path;

use tauri::State;

use crate::{
    desktop_open::open_path,
    desktop_runtime::DesktopRuntime,
    local_repository::{clone_github_repository, DesktopCloneRepositoryResult},
};

/// Clones a GitHub repository to the specified directory and opens it.
#[tauri::command]
pub(crate) async fn desktop_clone_repository(
    runtime: State<'_, DesktopRuntime>,
    repository_url: String,
    destination_directory: String,
) -> Result<DesktopCloneRepositoryResult, String> {
    let app_data_dir = runtime.app_data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        clone_github_repository(
            &app_data_dir,
            &repository_url,
            Path::new(&destination_directory),
            open_path,
        )
    })
    .await
    .map_err(|error| format!("failed to run git clone task: {error}"))?
}
