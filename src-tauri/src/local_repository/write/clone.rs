//! Repository cloning for Local git repository operations / Write git operations.

use std::{path::Path, process::Command};

use crate::local_repository::{
    parse::git_command_failure_details,
    process::{git_network_timeout, run_command_with_timeout},
    storage::{path_to_display_string, remember_local_repository},
    types::DesktopCloneRepositoryResult,
    url::{clone_destination_path, normalize_github_repository_clone_url},
};

/// Creates a deep copy.
pub(crate) fn clone_github_repository(
    app_data_dir: &Path,
    repository_url: &str,
    destination_directory: &Path,
    open_path: impl FnOnce(&Path) -> Result<(), String>,
) -> Result<DesktopCloneRepositoryResult, String> {
    let normalized_url = normalize_github_repository_clone_url(repository_url)
        .ok_or_else(|| "refusing to clone unsupported GitHub repository URL".to_owned())?;
    if !destination_directory.is_dir() {
        return Err("clone destination must be an existing directory".to_owned());
    }

    let destination_path = clone_destination_path(&normalized_url, destination_directory)?;
    if destination_path.exists() {
        return Err(format!(
            "clone destination already exists: {}",
            path_to_display_string(&destination_path)
        ));
    }

    let mut command = Command::new("git");
    command
        .arg("clone")
        .arg(&normalized_url)
        .arg(&destination_path)
        .env("GIT_TERMINAL_PROMPT", "0");
    let output = run_command_with_timeout(&mut command, "git clone", git_network_timeout())?;

    if !output.status.success() {
        let details = git_command_failure_details(&output);
        return Err(format!("git clone failed: {details}"));
    }

    let open_destination_error = open_path(&destination_path).err();
    remember_local_repository(app_data_dir, &normalized_url, &destination_path)?;

    Ok(DesktopCloneRepositoryResult {
        repository_url: normalized_url,
        destination_path: path_to_display_string(&destination_path),
        opened_destination: open_destination_error.is_none(),
        open_destination_error,
    })
}
