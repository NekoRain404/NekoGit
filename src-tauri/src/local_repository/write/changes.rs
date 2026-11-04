//! Changes for Local git repository operations / Write git operations.

use std::path::Path;

use crate::local_repository::{
    parse::{git_command_failure_details, normalize_local_commit_message},
    read::local_repository_git_status,
    types::{DesktopLocalRepositoryGitStatus, MAX_LOCAL_REPOSITORY_STASH_INDEX},
};

use super::git::git_command;

/// Creates a git commit.
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

/// Pops a stash entry and returns the updated git status.
pub(crate) fn pop_local_repository_stash(
    app_data_dir: &Path,
    repository_url: &str,
    index: u32,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    if index > MAX_LOCAL_REPOSITORY_STASH_INDEX {
        return Err(format!(
            "stash index must be between 0 and {MAX_LOCAL_REPOSITORY_STASH_INDEX}"
        ));
    }

    let git_status = local_repository_git_status(app_data_dir, repository_url)?;
    if git_status.conflicted > 0 {
        return Err("local repository has unresolved conflicts".to_owned());
    }

    let stash_ref = format!("stash@{{{index}}}");
    let output = git_command(&git_status.repository_path)
        .args(["stash", "pop"])
        .arg(&stash_ref)
        .output()
        .map_err(|error| format!("failed to start git stash pop: {error}"))?;

    if !output.status.success() {
        let details = git_command_failure_details(&output);
        return Err(format!("git stash pop failed: {details}"));
    }

    local_repository_git_status(app_data_dir, &git_status.repository_url)
}

/// Stashes current changes.
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

#[cfg(test)]
mod tests {
    use std::{
        fs,
        path::{Path, PathBuf},
        process::Command,
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::*;
    use crate::local_repository::{
        read::local_repository_stashes, storage::remember_local_repository,
    };

    const REPOSITORY_URL: &str = "https://github.com/owner/repo.git";

    fn test_base(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "nekogit-stash-pop-{name}-{}-{nanos}",
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

    fn init_repository_with_stash(base: &Path) -> PathBuf {
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
        fs::write(repository_path.join("README.md"), "changed\n").unwrap();
        git(
            &repository_path,
            &[
                "stash",
                "push",
                "-q",
                "--include-untracked",
                "-m",
                "test stash",
            ],
        );
        remember_local_repository(base, REPOSITORY_URL, &repository_path).unwrap();
        repository_path
    }

    #[test]
    fn rejects_stash_indices_above_the_limit() {
        let base = test_base("index-bound");
        fs::create_dir_all(&base).unwrap();

        let error =
            pop_local_repository_stash(&base, REPOSITORY_URL, MAX_LOCAL_REPOSITORY_STASH_INDEX + 1)
                .unwrap_err();

        assert!(error.contains("stash index must be between"));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn pops_the_latest_stash_and_returns_updated_status() {
        let base = test_base("pop");
        let repository_path = init_repository_with_stash(&base);
        let stashes = local_repository_stashes(&base, REPOSITORY_URL).unwrap();
        assert_eq!(stashes.stashes.len(), 1);
        assert_eq!(stashes.stashes[0].index, 0);

        let status = pop_local_repository_stash(&base, REPOSITORY_URL, 0).unwrap();

        assert!(!status.clean);
        assert_eq!(status.unstaged, 1);
        assert!(local_repository_stashes(&base, REPOSITORY_URL)
            .unwrap()
            .stashes
            .is_empty());
        assert_eq!(
            fs::read_to_string(repository_path.join("README.md")).unwrap(),
            "changed\n"
        );
        let _ = fs::remove_dir_all(&base);
    }
}
