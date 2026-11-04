//! Changes for Local git repository operations / Write git operations.

use std::path::{Path, PathBuf};

use crate::local_repository::{
    parse::{git_command_failure_details, normalize_local_commit_message},
    paths::normalize_repository_relative_path,
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

/// Normalizes and validates a repository-relative path used by file-level actions.
fn normalize_changed_file_path(relative_path: &str) -> Result<PathBuf, String> {
    let normalized_path = normalize_repository_relative_path(relative_path)?;
    if normalized_path.as_os_str().is_empty() {
        return Err("repository path must not be empty".to_owned());
    }

    Ok(normalized_path)
}

/// Rejects a path that currently has unresolved merge conflicts.
fn ensure_file_has_no_conflicts(
    repository_path: &str,
    relative_path: &Path,
    action: &str,
) -> Result<(), String> {
    let output = git_command(repository_path)
        .args(["ls-files", "-u", "--"])
        .arg(relative_path)
        .output()
        .map_err(|error| format!("failed to start git ls-files: {error}"))?;

    if !output.status.success() {
        let details = git_command_failure_details(&output);
        return Err(format!("git ls-files failed: {details}"));
    }

    if !output.stdout.is_empty() {
        return Err(format!("cannot {action} a file with unresolved conflicts"));
    }

    Ok(())
}

fn git_has_head(repository_path: &str) -> Result<bool, String> {
    let output = git_command(repository_path)
        .args(["rev-parse", "--verify", "--quiet", "HEAD"])
        .output()
        .map_err(|error| format!("failed to start git rev-parse: {error}"))?;

    Ok(output.status.success())
}

fn is_initial_commit_restore_failure(details: &str) -> bool {
    let details = details.to_ascii_lowercase();
    details.contains("could not resolve head")
        || details.contains("ambiguous argument 'head'")
        || details.contains("bad revision 'head'")
        || details.contains("unknown revision or path not in the working tree")
}

/// Removes a path from the index, falling back to `git rm --cached` before the first commit.
fn unstage_repository_path(repository_path: &str, relative_path: &Path) -> Result<(), String> {
    if git_has_head(repository_path)? {
        let output = git_command(repository_path)
            .args(["restore", "--staged", "--"])
            .arg(relative_path)
            .output()
            .map_err(|error| format!("failed to start git restore --staged: {error}"))?;

        if output.status.success() {
            return Ok(());
        }

        let details = git_command_failure_details(&output);
        if !is_initial_commit_restore_failure(&details) {
            return Err(format!("git restore --staged failed: {details}"));
        }
    }

    let output = git_command(repository_path)
        .args(["rm", "--cached", "--ignore-unmatch", "--"])
        .arg(relative_path)
        .output()
        .map_err(|error| format!("failed to start git rm --cached: {error}"))?;

    if !output.status.success() {
        let details = git_command_failure_details(&output);
        return Err(format!("git rm --cached failed: {details}"));
    }

    Ok(())
}

/// Stages a single repository-relative path and returns the updated git status.
pub(crate) fn stage_local_repository_path(
    app_data_dir: &Path,
    repository_url: &str,
    relative_path: &str,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let relative_path = normalize_changed_file_path(relative_path)?;
    let git_status = local_repository_git_status(app_data_dir, repository_url)?;
    ensure_file_has_no_conflicts(&git_status.repository_path, &relative_path, "stage")?;

    let output = git_command(&git_status.repository_path)
        .args(["add", "--"])
        .arg(&relative_path)
        .output()
        .map_err(|error| format!("failed to start git add: {error}"))?;

    if !output.status.success() {
        let details = git_command_failure_details(&output);
        return Err(format!("git add failed: {details}"));
    }

    local_repository_git_status(app_data_dir, &git_status.repository_url)
}

/// Unstages a single repository-relative path and returns the updated git status.
pub(crate) fn unstage_local_repository_path(
    app_data_dir: &Path,
    repository_url: &str,
    relative_path: &str,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let relative_path = normalize_changed_file_path(relative_path)?;
    let git_status = local_repository_git_status(app_data_dir, repository_url)?;
    ensure_file_has_no_conflicts(&git_status.repository_path, &relative_path, "unstage")?;
    unstage_repository_path(&git_status.repository_path, &relative_path)?;

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

/// Applies a stash entry without removing it and returns the updated git status.
pub(crate) fn apply_local_repository_stash(
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
        .args(["stash", "apply"])
        .arg(&stash_ref)
        .output()
        .map_err(|error| format!("failed to start git stash apply: {error}"))?;

    if !output.status.success() {
        let details = git_command_failure_details(&output);
        return Err(format!("git stash apply failed: {details}"));
    }

    local_repository_git_status(app_data_dir, &git_status.repository_url)
}

/// Clears every stash entry and returns the updated git status.
pub(crate) fn clear_local_repository_stashes(
    app_data_dir: &Path,
    repository_url: &str,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let git_status = local_repository_git_status(app_data_dir, repository_url)?;

    let output = git_command(&git_status.repository_path)
        .args(["stash", "clear"])
        .output()
        .map_err(|error| format!("failed to start git stash clear: {error}"))?;

    if !output.status.success() {
        let details = git_command_failure_details(&output);
        return Err(format!("git stash clear failed: {details}"));
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

    fn init_repository_without_commit(base: &Path) -> PathBuf {
        let repository_path = base.join("repo");
        fs::create_dir_all(&repository_path).unwrap();
        git(&repository_path, &["init", "-q", "-b", "main"]);
        git(&repository_path, &["config", "user.name", "NekoGit Test"]);
        git(
            &repository_path,
            &["config", "user.email", "nekogit@example.com"],
        );
        repository_path
    }

    fn init_repository(base: &Path) -> PathBuf {
        let repository_path = init_repository_without_commit(base);
        fs::write(repository_path.join("README.md"), "hello\n").unwrap();
        git(&repository_path, &["add", "README.md"]);
        git(&repository_path, &["commit", "-q", "-m", "initial"]);
        repository_path
    }

    fn init_repository_with_stash(base: &Path) -> PathBuf {
        let repository_path = init_repository(base);
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

    fn init_conflicted_repository(base: &Path) -> PathBuf {
        let repository_path = init_repository(base);
        git(&repository_path, &["checkout", "-q", "-b", "feature"]);
        fs::write(repository_path.join("README.md"), "feature\n").unwrap();
        git(&repository_path, &["add", "README.md"]);
        git(&repository_path, &["commit", "-q", "-m", "feature"]);
        git(&repository_path, &["checkout", "-q", "main"]);
        fs::write(repository_path.join("README.md"), "main\n").unwrap();
        git(&repository_path, &["add", "README.md"]);
        git(&repository_path, &["commit", "-q", "-m", "main"]);
        let output = Command::new("git")
            .arg("-C")
            .arg(&repository_path)
            .args(["merge", "feature"])
            .output()
            .unwrap();
        assert!(
            !output.status.success(),
            "merge should produce a conflict: {}",
            String::from_utf8_lossy(&output.stdout)
        );
        repository_path
    }

    fn git_output(repository_path: &Path, args: &[&str]) -> String {
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
        String::from_utf8_lossy(&output.stdout).into_owned()
    }

    #[test]
    fn stages_an_untracked_file() {
        let base = test_base("stage-untracked");
        let repository_path = init_repository(&base);
        remember_local_repository(&base, REPOSITORY_URL, &repository_path).unwrap();
        fs::write(repository_path.join("new.txt"), "new\n").unwrap();

        let status = stage_local_repository_path(&base, REPOSITORY_URL, "new.txt").unwrap();

        assert!(!status.clean);
        assert_eq!(status.staged, 1);
        assert_eq!(status.untracked, 0);
        assert_eq!(
            git_output(&repository_path, &["diff", "--cached", "--name-only"]).trim(),
            "new.txt"
        );
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn unstages_a_staged_file() {
        let base = test_base("unstage");
        let repository_path = init_repository(&base);
        remember_local_repository(&base, REPOSITORY_URL, &repository_path).unwrap();
        fs::write(repository_path.join("new.txt"), "new\n").unwrap();
        git(&repository_path, &["add", "new.txt"]);

        let status = unstage_local_repository_path(&base, REPOSITORY_URL, "new.txt").unwrap();

        assert_eq!(status.staged, 0);
        assert_eq!(status.untracked, 1);
        assert!(
            git_output(&repository_path, &["diff", "--cached", "--name-only"])
                .trim()
                .is_empty()
        );
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn unstages_a_staged_file_before_the_first_commit() {
        let base = test_base("unstage-initial");
        let repository_path = init_repository_without_commit(&base);
        remember_local_repository(&base, REPOSITORY_URL, &repository_path).unwrap();
        fs::write(repository_path.join("first.txt"), "first\n").unwrap();
        git(&repository_path, &["add", "first.txt"]);

        let status = unstage_local_repository_path(&base, REPOSITORY_URL, "first.txt").unwrap();

        assert_eq!(status.staged, 0);
        assert_eq!(status.untracked, 1);
        assert!(git_output(&repository_path, &["ls-files"])
            .trim()
            .is_empty());
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn stages_a_modified_file() {
        let base = test_base("stage-modified");
        let repository_path = init_repository(&base);
        remember_local_repository(&base, REPOSITORY_URL, &repository_path).unwrap();
        fs::write(repository_path.join("README.md"), "changed\n").unwrap();

        let status = stage_local_repository_path(&base, REPOSITORY_URL, "README.md").unwrap();

        assert_eq!(status.staged, 1);
        assert_eq!(status.unstaged, 0);
        assert_eq!(
            git_output(&repository_path, &["diff", "--cached", "--name-only"]).trim(),
            "README.md"
        );
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn stages_a_deleted_file() {
        let base = test_base("stage-deleted");
        let repository_path = init_repository(&base);
        remember_local_repository(&base, REPOSITORY_URL, &repository_path).unwrap();
        fs::remove_file(repository_path.join("README.md")).unwrap();

        let status = stage_local_repository_path(&base, REPOSITORY_URL, "README.md").unwrap();

        assert_eq!(status.staged, 1);
        assert_eq!(status.unstaged, 0);
        assert!(
            git_output(&repository_path, &["diff", "--cached", "--name-status"])
                .lines()
                .any(|line| line == "D\tREADME.md")
        );
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn unstages_only_the_requested_path() {
        let base = test_base("unstage-scoped");
        let repository_path = init_repository(&base);
        remember_local_repository(&base, REPOSITORY_URL, &repository_path).unwrap();
        fs::write(repository_path.join("one.txt"), "one\n").unwrap();
        fs::write(repository_path.join("two.txt"), "two\n").unwrap();
        git(&repository_path, &["add", "one.txt", "two.txt"]);

        let status = unstage_local_repository_path(&base, REPOSITORY_URL, "one.txt").unwrap();

        assert_eq!(status.staged, 1);
        assert_eq!(status.untracked, 1);
        assert_eq!(
            git_output(&repository_path, &["diff", "--cached", "--name-only"]).trim(),
            "two.txt"
        );
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn rejects_empty_and_unsafe_paths() {
        let base = test_base("paths");
        let repository_path = init_repository(&base);
        remember_local_repository(&base, REPOSITORY_URL, &repository_path).unwrap();

        let empty = stage_local_repository_path(&base, REPOSITORY_URL, "   ").unwrap_err();
        assert!(empty.contains("must not be empty"));

        let parent =
            unstage_local_repository_path(&base, REPOSITORY_URL, "../README.md").unwrap_err();
        assert!(parent.contains("must stay inside"));

        let control = stage_local_repository_path(&base, REPOSITORY_URL, "bad\nname").unwrap_err();
        assert!(control.contains("control characters"));

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn rejects_staging_and_unstaging_conflicted_files() {
        let base = test_base("conflict");
        let repository_path = init_conflicted_repository(&base);
        remember_local_repository(&base, REPOSITORY_URL, &repository_path).unwrap();

        let stage_error =
            stage_local_repository_path(&base, REPOSITORY_URL, "README.md").unwrap_err();
        assert!(stage_error.contains("unresolved conflicts"));

        let unstage_error =
            unstage_local_repository_path(&base, REPOSITORY_URL, "README.md").unwrap_err();
        assert!(unstage_error.contains("unresolved conflicts"));

        let _ = fs::remove_dir_all(&base);
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
    fn rejects_apply_indices_above_the_limit() {
        let base = test_base("apply-index-bound");
        fs::create_dir_all(&base).unwrap();

        let error = apply_local_repository_stash(
            &base,
            REPOSITORY_URL,
            MAX_LOCAL_REPOSITORY_STASH_INDEX + 1,
        )
        .unwrap_err();

        assert!(error.contains("stash index must be between"));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn applies_the_latest_stash_without_dropping_it() {
        let base = test_base("apply");
        let repository_path = init_repository_with_stash(&base);
        let stashes = local_repository_stashes(&base, REPOSITORY_URL).unwrap();
        assert_eq!(stashes.stashes.len(), 1);
        assert_eq!(stashes.stashes[0].index, 0);

        let status = apply_local_repository_stash(&base, REPOSITORY_URL, 0).unwrap();

        assert!(!status.clean);
        assert_eq!(status.unstaged, 1);
        assert_eq!(
            fs::read_to_string(repository_path.join("README.md")).unwrap(),
            "changed\n"
        );
        let stashes = local_repository_stashes(&base, REPOSITORY_URL).unwrap();
        assert_eq!(stashes.stashes.len(), 1);
        assert_eq!(stashes.stashes[0].index, 0);
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn rejects_applying_a_stash_while_conflicted() {
        let base = test_base("apply-conflict");
        let repository_path = init_conflicted_repository(&base);
        remember_local_repository(&base, REPOSITORY_URL, &repository_path).unwrap();

        let error = apply_local_repository_stash(&base, REPOSITORY_URL, 0).unwrap_err();

        assert!(error.contains("unresolved conflicts"));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn clears_all_stashes() {
        let base = test_base("clear");
        let repository_path = init_repository(&base);
        fs::write(repository_path.join("README.md"), "first\n").unwrap();
        git(
            &repository_path,
            &["stash", "push", "-q", "-m", "first stash"],
        );
        fs::write(repository_path.join("README.md"), "second\n").unwrap();
        git(
            &repository_path,
            &["stash", "push", "-q", "-m", "second stash"],
        );
        remember_local_repository(&base, REPOSITORY_URL, &repository_path).unwrap();
        assert_eq!(
            local_repository_stashes(&base, REPOSITORY_URL)
                .unwrap()
                .stashes
                .len(),
            2
        );

        let status = clear_local_repository_stashes(&base, REPOSITORY_URL).unwrap();

        assert!(status.clean);
        assert!(local_repository_stashes(&base, REPOSITORY_URL)
            .unwrap()
            .stashes
            .is_empty());
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
