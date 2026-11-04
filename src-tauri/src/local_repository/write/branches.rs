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

/// Rebase the current local branch onto `target_branch`, or onto its upstream when omitted.
///
/// The worktree must be clean and free of unresolved conflicts. Targets are validated
/// before they reach Git so option-like or malformed refs cannot be injected.
pub(crate) fn rebase_local_repository(
    app_data_dir: &Path,
    repository_url: &str,
    target_branch: Option<&str>,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let git_status = local_repository_git_status(app_data_dir, repository_url)?;
    if rebase_in_progress(&git_status.repository_path) {
        return Err(
            "a rebase is already in progress; resolve the conflicts or abort it before starting another rebase"
                .to_owned(),
        );
    }
    if git_status.conflicted > 0 {
        return Err(
            "local repository has unresolved conflicts; resolve them before rebasing".to_owned(),
        );
    }
    if !git_status.clean {
        return Err(
            "local repository has uncommitted changes; commit or stash them before rebasing"
                .to_owned(),
        );
    }

    let target = match target_branch {
        Some(target_branch) => normalize_rebase_target(target_branch)?,
        None => {
            let upstream = git_status.upstream.as_deref().ok_or_else(|| {
                "local branch has no upstream; choose a target branch to rebase onto".to_owned()
            })?;
            normalize_rebase_upstream(upstream)?
        }
    };

    let output = git_command(&git_status.repository_path)
        .arg("rebase")
        .arg(&target)
        .output()
        .map_err(|error| format!("failed to start git rebase: {error}"))?;

    if !output.status.success() {
        let details = git_command_failure_details(&output);
        let mut message = format!("git rebase failed: {details}");
        if rebase_in_progress(&git_status.repository_path) {
            message.push_str(
                "\n\nThe rebase is still in progress. Resolve the conflicts and stage the resolved files, or abort it with the Abort Rebase action (git rebase --abort).",
            );
        }
        return Err(message);
    }

    local_repository_git_status(app_data_dir, &git_status.repository_url)
}

/// Abort an in-progress rebase and return the restored git status.
pub(crate) fn abort_local_repository_rebase(
    app_data_dir: &Path,
    repository_url: &str,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let git_status = local_repository_git_status(app_data_dir, repository_url)?;
    if !rebase_in_progress(&git_status.repository_path) {
        return Err("no rebase is in progress".to_owned());
    }

    let output = git_command(&git_status.repository_path)
        .args(["rebase", "--abort"])
        .output()
        .map_err(|error| format!("failed to start git rebase --abort: {error}"))?;

    if !output.status.success() {
        let details = git_command_failure_details(&output);
        return Err(format!("git rebase --abort failed: {details}"));
    }

    local_repository_git_status(app_data_dir, &git_status.repository_url)
}

/// Normalizes a user-supplied rebase target, allowing only safe local refs or `origin/<branch>`.
fn normalize_rebase_target(target_branch: &str) -> Result<String, String> {
    let target_branch = target_branch.trim();
    if target_branch.is_empty() {
        return Err("rebase target must not be empty".to_owned());
    }
    if target_branch.starts_with('-') || target_branch.chars().any(char::is_control) {
        return Err("rebase target is not supported".to_owned());
    }

    if target_branch.starts_with("origin/") {
        normalize_origin_remote_branch_name(target_branch).map(|(name, _)| name)
    } else {
        normalize_local_branch_name(target_branch)
    }
}

/// Validates an existing upstream ref before handing it to Git.
fn normalize_rebase_upstream(upstream: &str) -> Result<String, String> {
    let upstream = upstream.trim();
    if upstream.is_empty() {
        return Err("local branch has no upstream to rebase onto".to_owned());
    }
    if upstream.starts_with('-') || upstream.chars().any(char::is_control) {
        return Err("local branch upstream is not supported".to_owned());
    }

    normalize_local_branch_name(upstream)
}

/// Returns whether Git reports an active rebase state directory.
fn rebase_in_progress(repository_path: &str) -> bool {
    ["rebase-merge", "rebase-apply"].iter().any(|state| {
        rebase_state_path(repository_path, state)
            .is_some_and(|path| Path::new(repository_path).join(path).exists())
    })
}

/// Resolves a rebase state directory with `git rev-parse --git-path <state>`.
fn rebase_state_path(repository_path: &str, state: &str) -> Option<String> {
    let output = git_command(repository_path)
        .args(["rev-parse", "--git-path", state])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    let path = String::from_utf8_lossy(&output.stdout).trim().to_owned();
    (!path.is_empty()).then_some(path)
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
    fn commit_file(repository_path: &Path, relative_path: &str, contents: &str, message: &str) {
        fs::write(repository_path.join(relative_path), contents).unwrap();
        git(repository_path, &["add", relative_path]);
        git(repository_path, &["commit", "-q", "-m", message]);
    }

    fn set_origin_main(repository_path: &Path) {
        git(
            repository_path,
            &[
                "remote",
                "add",
                "origin",
                "https://github.com/owner/repo.git",
            ],
        );
        git(
            repository_path,
            &["update-ref", "refs/remotes/origin/main", "main"],
        );
    }

    fn commit_subjects(repository_path: &Path) -> String {
        let output = Command::new("git")
            .arg("-C")
            .arg(repository_path)
            .args(["log", "--format=%s"])
            .output()
            .unwrap();
        assert!(output.status.success());
        String::from_utf8_lossy(&output.stdout).into_owned()
    }

    fn commit_count(repository_path: &Path) -> usize {
        let output = Command::new("git")
            .arg("-C")
            .arg(repository_path)
            .args(["rev-list", "--count", "HEAD"])
            .output()
            .unwrap();
        assert!(output.status.success());
        String::from_utf8_lossy(&output.stdout)
            .trim()
            .parse()
            .unwrap()
    }

    #[test]
    fn rebases_a_diverged_local_branch_onto_origin_target() {
        let base = test_base("rebase-success");
        let repository_path = init_repository_with_commit(&base);
        git(&repository_path, &["switch", "-q", "-c", "feature"]);
        commit_file(&repository_path, "feature.txt", "feature\n", "feature work");
        git(&repository_path, &["switch", "-q", "main"]);
        commit_file(&repository_path, "main.txt", "main\n", "main work");
        set_origin_main(&repository_path);
        git(&repository_path, &["switch", "-q", "feature"]);

        let status = rebase_local_repository(&base, REPOSITORY_URL, Some("origin/main")).unwrap();

        assert_eq!(status.branch.as_deref(), Some("feature"));
        assert!(status.clean);
        assert_eq!(commit_count(&repository_path), 3);
        let subjects = commit_subjects(&repository_path);
        assert!(subjects.contains("initial"));
        assert!(subjects.contains("main work"));
        assert!(subjects.contains("feature work"));
        assert!(!rebase_in_progress(repository_path.to_str().unwrap()));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn rebases_onto_the_current_upstream_when_no_target_is_given() {
        let base = test_base("rebase-upstream");
        let repository_path = init_repository_with_commit(&base);
        git(&repository_path, &["switch", "-q", "-c", "feature"]);
        commit_file(&repository_path, "feature.txt", "feature\n", "feature work");
        git(&repository_path, &["switch", "-q", "main"]);
        commit_file(&repository_path, "main.txt", "main\n", "main work");
        set_origin_main(&repository_path);
        git(&repository_path, &["switch", "-q", "feature"]);
        git(
            &repository_path,
            &["config", "branch.feature.remote", "origin"],
        );
        git(
            &repository_path,
            &["config", "branch.feature.merge", "refs/heads/main"],
        );

        let status = rebase_local_repository(&base, REPOSITORY_URL, None).unwrap();

        assert_eq!(status.branch.as_deref(), Some("feature"));
        assert_eq!(status.upstream.as_deref(), Some("origin/main"));
        assert_eq!(commit_count(&repository_path), 3);
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn rejects_rebasing_a_dirty_worktree() {
        let base = test_base("rebase-dirty");
        let repository_path = init_repository_with_commit(&base);
        fs::write(repository_path.join("README.md"), "uncommitted\n").unwrap();

        let error = rebase_local_repository(&base, REPOSITORY_URL, Some("main")).unwrap_err();

        assert!(error.contains("uncommitted changes"));
        assert!(!rebase_in_progress(repository_path.to_str().unwrap()));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn rejects_unsafe_rebase_targets() {
        let base = test_base("rebase-target-validation");
        let repository_path = init_repository_with_commit(&base);

        for target in [
            "-option",
            "feature..bad",
            "origin/feature..bad",
            "bad\u{7}target",
        ] {
            let error = rebase_local_repository(&base, REPOSITORY_URL, Some(target)).unwrap_err();
            assert!(
                error.contains("not supported"),
                "target `{target}` should be rejected, got: {error}"
            );
        }
        assert!(!rebase_in_progress(repository_path.to_str().unwrap()));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn conflicting_rebase_stays_in_progress_until_aborted() {
        let base = test_base("rebase-conflict");
        let repository_path = init_repository_with_commit(&base);
        commit_file(&repository_path, "conflict.txt", "base\n", "base");
        git(&repository_path, &["switch", "-q", "-c", "feature"]);
        commit_file(
            &repository_path,
            "conflict.txt",
            "feature\n",
            "feature work",
        );
        git(&repository_path, &["switch", "-q", "main"]);
        commit_file(&repository_path, "conflict.txt", "main\n", "main work");
        set_origin_main(&repository_path);
        git(&repository_path, &["switch", "-q", "feature"]);

        let error =
            rebase_local_repository(&base, REPOSITORY_URL, Some("origin/main")).unwrap_err();

        assert!(error.contains("git rebase failed"));
        assert!(error.contains("rebase is still in progress"));
        assert!(rebase_in_progress(repository_path.to_str().unwrap()));

        let status = abort_local_repository_rebase(&base, REPOSITORY_URL).unwrap();

        assert_eq!(status.branch.as_deref(), Some("feature"));
        assert!(!rebase_in_progress(repository_path.to_str().unwrap()));
        assert_eq!(
            fs::read_to_string(repository_path.join("conflict.txt")).unwrap(),
            "feature\n"
        );
        assert_eq!(commit_count(&repository_path), 3);
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn aborting_without_a_rebase_returns_a_clear_error() {
        let base = test_base("rebase-abort-missing");
        let repository_path = init_repository_with_commit(&base);

        let error = abort_local_repository_rebase(&base, REPOSITORY_URL).unwrap_err();

        assert_eq!(error, "no rebase is in progress");
        assert!(!rebase_in_progress(repository_path.to_str().unwrap()));
        let _ = fs::remove_dir_all(&base);
    }
}
