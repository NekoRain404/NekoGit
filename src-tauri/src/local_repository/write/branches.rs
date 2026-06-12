use std::path::Path;

use crate::local_repository::{
    parse::{
        git_command_failure_details, normalize_local_branch_name,
        normalize_origin_remote_branch_name,
    },
    read::local_repository_git_status,
    types::DesktopLocalRepositoryGitStatus,
};

use super::git::{branch_name_exists, git_command, remote_branch_exists};

pub(crate) fn switch_local_repository_branch(
    app_data_dir: &Path,
    repository_url: &str,
    branch_name: &str,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let git_status = local_repository_git_status(app_data_dir, repository_url)?;
    if !git_status.clean {
        return Err("local repository has uncommitted changes; commit or stash them before switching branches".to_owned());
    }

    let branch_name = normalize_local_branch_name(branch_name)?;
    if git_status.branch.as_deref() == Some(branch_name.as_str()) {
        return Ok(git_status);
    }
    if !branch_name_exists(&git_status.repository_path, &branch_name)? {
        return Err("local branch does not exist".to_owned());
    }

    let output = git_command(&git_status.repository_path)
        .args(["switch", "--"])
        .arg(&branch_name)
        .output()
        .map_err(|error| format!("failed to start git switch: {error}"))?;

    if !output.status.success() {
        let details = git_command_failure_details(&output);
        return Err(format!("git switch failed: {details}"));
    }

    local_repository_git_status(app_data_dir, &git_status.repository_url)
}

pub(crate) fn create_local_repository_branch(
    app_data_dir: &Path,
    repository_url: &str,
    branch_name: &str,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let git_status = local_repository_git_status(app_data_dir, repository_url)?;
    if !git_status.clean {
        return Err("local repository has uncommitted changes; commit or stash them before creating branches".to_owned());
    }

    let branch_name = normalize_local_branch_name(branch_name)?;
    if branch_name_exists(&git_status.repository_path, &branch_name)? {
        return Err("local branch already exists".to_owned());
    }

    let output = git_command(&git_status.repository_path)
        .args(["switch", "-c"])
        .arg(&branch_name)
        .output()
        .map_err(|error| format!("failed to start git switch: {error}"))?;

    if !output.status.success() {
        let details = git_command_failure_details(&output);
        return Err(format!("git switch failed: {details}"));
    }

    local_repository_git_status(app_data_dir, &git_status.repository_url)
}

pub(crate) fn checkout_remote_local_repository_branch(
    app_data_dir: &Path,
    repository_url: &str,
    remote_branch_name: &str,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let git_status = local_repository_git_status(app_data_dir, repository_url)?;
    if !git_status.clean {
        return Err("local repository has uncommitted changes; commit or stash them before checking out remote branches".to_owned());
    }

    let (remote_branch_name, local_branch_name) =
        normalize_origin_remote_branch_name(remote_branch_name)?;
    if branch_name_exists(&git_status.repository_path, &local_branch_name)? {
        return Err("local branch already exists; switch to the local branch instead".to_owned());
    }
    if !remote_branch_exists(&git_status.repository_path, &remote_branch_name)? {
        return Err("remote branch does not exist".to_owned());
    }

    let output = git_command(&git_status.repository_path)
        .args(["switch", "--track", "-c"])
        .arg(&local_branch_name)
        .arg(&remote_branch_name)
        .output()
        .map_err(|error| format!("failed to start git switch: {error}"))?;

    if !output.status.success() {
        let details = git_command_failure_details(&output);
        return Err(format!("git switch failed: {details}"));
    }

    local_repository_git_status(app_data_dir, &git_status.repository_url)
}
