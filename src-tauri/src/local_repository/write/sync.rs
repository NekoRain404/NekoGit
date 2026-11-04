//! Fetch/push/pull operations for Local git repository operations / Write git operations.

use std::path::Path;

use crate::local_repository::{
    parse::{git_command_failure_details, normalize_local_branch_name},
    process::{git_network_timeout, run_command_with_timeout},
    read::local_repository_git_status,
    storage::local_repository_status,
    types::DesktopLocalRepositoryGitStatus,
};

use super::git::git_command;

/// Fetches data from the source.
pub(crate) fn fetch_local_repository(
    app_data_dir: &Path,
    repository_url: &str,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let status = local_repository_status(app_data_dir, repository_url)?;
    let Some(repository_path) = status.path.as_deref() else {
        return Err("local repository is not available".to_owned());
    };

    let mut command = git_command(repository_path);
    command.args(["fetch", "--prune"]);
    let output = run_command_with_timeout(&mut command, "git fetch", git_network_timeout())?;

    if !output.status.success() {
        let details = git_command_failure_details(&output);
        return Err(format!("git fetch failed: {details}"));
    }

    local_repository_git_status(app_data_dir, &status.repository_url)
}

/// Pulls changes from the remote.
pub(crate) fn pull_local_repository(
    app_data_dir: &Path,
    repository_url: &str,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let status = local_repository_status(app_data_dir, repository_url)?;
    let Some(repository_path) = status.path.as_deref() else {
        return Err("local repository is not available".to_owned());
    };

    let mut command = git_command(repository_path);
    command.args(["pull", "--ff-only"]);
    let output = run_command_with_timeout(&mut command, "git pull", git_network_timeout())?;

    if !output.status.success() {
        let details = git_command_failure_details(&output);
        return Err(format!("git pull failed: {details}"));
    }

    local_repository_git_status(app_data_dir, &status.repository_url)
}

/// Pushes changes to the remote.
pub(crate) fn push_local_repository(
    app_data_dir: &Path,
    repository_url: &str,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let git_status = local_repository_git_status(app_data_dir, repository_url)?;
    if !git_status.clean {
        return Err(
            "local repository has uncommitted changes; commit or stash them before pushing"
                .to_owned(),
        );
    }

    let branch_name = git_status
        .branch
        .as_deref()
        .ok_or_else(|| "local repository is not on a branch".to_owned())
        .and_then(normalize_local_branch_name)?;

    if git_status.upstream.is_some() && git_status.ahead == 0 {
        return Err("local repository has no commits to push".to_owned());
    }

    let mut command = git_command(&git_status.repository_path);
    if git_status.upstream.is_some() {
        command.arg("push");
    } else {
        command
            .args(["push", "--set-upstream", "origin"])
            .arg(&branch_name);
    }
    let output = run_command_with_timeout(&mut command, "git push", git_network_timeout())?;

    if !output.status.success() {
        let details = git_command_failure_details(&output);
        return Err(format!("git push failed: {details}"));
    }

    local_repository_git_status(app_data_dir, &git_status.repository_url)
}
