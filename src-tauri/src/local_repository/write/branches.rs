//! Branch list parsing for Local git repository operations / Write git operations.

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

/// Switch local repository branch.
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

/// Creates a new resource.
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

/// Switches to a branch or ref.
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

/// Deletes a local branch using Git's safe delete (`-d`) mode.
pub(crate) fn delete_local_repository_branch(
    app_data_dir: &Path,
    repository_url: &str,
    branch_name: &str,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let git_status = local_repository_git_status(app_data_dir, repository_url)?;
    let branch_name = normalize_local_branch_name(branch_name)?;
    if git_status.branch.as_deref() == Some(branch_name.as_str()) {
        return Err("cannot delete the current local branch".to_owned());
    }
    if !branch_name_exists(&git_status.repository_path, &branch_name)? {
        return Err("local branch does not exist".to_owned());
    }

    let output = git_command(&git_status.repository_path)
        .args(["branch", "-d", "--"])
        .arg(&branch_name)
        .output()
        .map_err(|error| format!("failed to start git branch delete: {error}"))?;

    if !output.status.success() {
        let details = git_command_failure_details(&output);
        return Err(format!("git branch delete failed: {details}"));
    }

    local_repository_git_status(app_data_dir, &git_status.repository_url)
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        path::{Path, PathBuf},
        process::Command,
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::*;
    use crate::local_repository::storage::remember_local_repository;

    const REPOSITORY_URL: &str = "https://github.com/owner/repo.git";

    fn test_base(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "nekogit-branch-delete-{name}-{}-{nanos}",
            std::process::id()
        ))
    }

    fn git(repository_path: &Path, args: &[&str]) {
        let output = Command::new("git")
            .arg("-C")
            .arg(repository_path)
            .args(args)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "git {:?} failed: {}",
            args,
            String::from_utf8_lossy(&output.stderr)
        );
    }

    fn init_repository_with_commit(base: &Path) -> PathBuf {
        let repository_path = base.join("repo");
        fs::create_dir_all(&repository_path).unwrap();
        git(&repository_path, &["init", "-q", "-b", "main"]);
        git(&repository_path, &["config", "user.name", "NekoGit Test"]);
        git(
            &repository_path,
            &["config", "user.email", "nekogit@example.com"],
        );
        fs::write(repository_path.join("README.md"), "hello\n").unwrap();
        git(&repository_path, &["add", "README.md"]);
        git(&repository_path, &["commit", "-q", "-m", "initial"]);
        remember_local_repository(base, REPOSITORY_URL, &repository_path).unwrap();
        repository_path
    }

    fn branch_exists(repository_path: &Path, branch_name: &str) -> bool {
        Command::new("git")
            .arg("-C")
            .arg(repository_path)
            .args([
                "rev-parse",
                "--verify",
                "--quiet",
                &format!("refs/heads/{branch_name}"),
            ])
            .output()
            .unwrap()
            .status
            .success()
    }

    #[test]
    fn deletes_a_merged_local_branch() {
        let base = test_base("merged");
        let repository_path = init_repository_with_commit(&base);
        git(&repository_path, &["branch", "feature/merged"]);
        assert!(branch_exists(&repository_path, "feature/merged"));

        let status =
            delete_local_repository_branch(&base, REPOSITORY_URL, "feature/merged").unwrap();

        assert_eq!(status.branch.as_deref(), Some("main"));
        assert!(!branch_exists(&repository_path, "feature/merged"));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn rejects_deleting_the_current_local_branch() {
        let base = test_base("current");
        let repository_path = init_repository_with_commit(&base);

        let error = delete_local_repository_branch(&base, REPOSITORY_URL, "main").unwrap_err();

        assert!(error.contains("current local branch"));
        assert!(branch_exists(&repository_path, "main"));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn refuses_to_delete_an_unmerged_local_branch() {
        let base = test_base("unmerged");
        let repository_path = init_repository_with_commit(&base);
        git(
            &repository_path,
            &["switch", "-q", "-c", "feature/unmerged"],
        );
        fs::write(repository_path.join("feature.txt"), "feature\n").unwrap();
        git(&repository_path, &["add", "feature.txt"]);
        git(&repository_path, &["commit", "-q", "-m", "feature work"]);
        git(&repository_path, &["switch", "-q", "main"]);

        let error =
            delete_local_repository_branch(&base, REPOSITORY_URL, "feature/unmerged").unwrap_err();

        assert!(error.contains("git branch delete failed"));
        assert!(branch_exists(&repository_path, "feature/unmerged"));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn rejects_missing_and_invalid_local_branch_names() {
        let base = test_base("validation");
        let repository_path = init_repository_with_commit(&base);

        assert_eq!(
            delete_local_repository_branch(&base, REPOSITORY_URL, "missing").unwrap_err(),
            "local branch does not exist"
        );
        assert_eq!(
            delete_local_repository_branch(&base, REPOSITORY_URL, "-option").unwrap_err(),
            "branch name is not supported"
        );
        assert!(branch_exists(&repository_path, "main"));
        let _ = fs::remove_dir_all(&base);
    }
}
