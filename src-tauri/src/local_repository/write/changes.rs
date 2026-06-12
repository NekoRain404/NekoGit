use std::path::Path;

use crate::local_repository::{
    parse::{git_command_failure_details, normalize_local_commit_message},
    read::local_repository_git_status,
    types::DesktopLocalRepositoryGitStatus,
};

use super::git::git_command;

pub(crate) fn commit_local_repository_changes(
    app_data_dir: &Path,
    repository_url: &str,
    commit_message: &str,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let git_status = local_repository_git_status(app_data_dir, repository_url)?;
    if git_status.clean {
        return Err("local repository has no changes to commit".to_owned());
    }
    if git_status.conflicted > 0 {
        return Err("local repository has unresolved conflicts".to_owned());
    }

    let commit_message = normalize_local_commit_message(commit_message)?;

    let output = git_command(&git_status.repository_path)
        .args(["add", "-A", "--", "."])
        .output()
        .map_err(|error| format!("failed to start git add: {error}"))?;

    if !output.status.success() {
        let details = git_command_failure_details(&output);
        return Err(format!("git add failed: {details}"));
    }

    let output = git_command(&git_status.repository_path)
        .args(["diff", "--cached", "--quiet", "--exit-code"])
        .output()
        .map_err(|error| format!("failed to start git diff --cached: {error}"))?;

    match output.status.code() {
        Some(0) => return Err("local repository has no staged changes to commit".to_owned()),
        Some(1) => {}
        _ => {
            let details = git_command_failure_details(&output);
            return Err(format!("git diff --cached failed: {details}"));
        }
    }

    let output = git_command(&git_status.repository_path)
        .args(["commit", "-m"])
        .arg(&commit_message)
        .output()
        .map_err(|error| format!("failed to start git commit: {error}"))?;

    if !output.status.success() {
        let details = git_command_failure_details(&output);
        return Err(format!("git commit failed: {details}"));
    }

    local_repository_git_status(app_data_dir, &git_status.repository_url)
}

pub(crate) fn stash_local_repository_changes(
    app_data_dir: &Path,
    repository_url: &str,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let git_status = local_repository_git_status(app_data_dir, repository_url)?;
    if git_status.clean {
        return Err("local repository has no changes to stash".to_owned());
    }
    if git_status.conflicted > 0 {
        return Err("local repository has unresolved conflicts".to_owned());
    }

    let branch_label = git_status.branch.as_deref().unwrap_or("detached HEAD");
    let stash_message = format!("NekoGit: stash {branch_label}");

    let output = git_command(&git_status.repository_path)
        .args(["stash", "push", "--include-untracked", "-m"])
        .arg(stash_message)
        .output()
        .map_err(|error| format!("failed to start git stash: {error}"))?;

    if !output.status.success() {
        let details = git_command_failure_details(&output);
        return Err(format!("git stash failed: {details}"));
    }

    local_repository_git_status(app_data_dir, &git_status.repository_url)
}
