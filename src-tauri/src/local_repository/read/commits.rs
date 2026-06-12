use std::path::Path;

use super::git::{resolve_local_repository_path, run_read_git_command};
use crate::local_repository::{
    parse::{
        parse_local_repository_git_commit_history_output, parse_local_repository_git_commit_output,
    },
    types::{DesktopLocalRepositoryCommitHistory, DesktopLocalRepositoryGitCommit},
};

pub(crate) fn local_repository_last_commit(
    repository_path: &str,
) -> Option<DesktopLocalRepositoryGitCommit> {
    let output = run_read_git_command(
        repository_path,
        &["log", "-1", "--format=%H%x00%h%x00%an%x00%ae%x00%ct%x00%s"],
        "failed to start git log",
        "git log failed",
    )
    .ok()?;

    parse_local_repository_git_commit_output(&String::from_utf8_lossy(&output.stdout))
}

pub(crate) fn local_repository_commit_history(
    app_data_dir: &Path,
    repository_url: &str,
    limit: u32,
) -> Result<DesktopLocalRepositoryCommitHistory, String> {
    let (repository_url, repository_path) =
        resolve_local_repository_path(app_data_dir, repository_url)?;
    let limit = limit.clamp(1, 50).to_string();
    let output = run_read_git_command(
        &repository_path,
        &[
            "log",
            "-n",
            &limit,
            "--format=%H%x00%h%x00%an%x00%ae%x00%ct%x00%s%x1e",
        ],
        "failed to start git log",
        "git log failed",
    )?;

    Ok(DesktopLocalRepositoryCommitHistory {
        repository_url,
        repository_path,
        commits: parse_local_repository_git_commit_history_output(&String::from_utf8_lossy(
            &output.stdout,
        )),
    })
}
