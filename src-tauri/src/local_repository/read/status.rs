//! Path status detection for Local git repository operations / Read-only git queries.

use std::path::Path;

use super::{
    commits::local_repository_last_commit,
    git::{resolve_local_repository_path, run_read_git_command},
};
use crate::local_repository::{
    parse::parse_local_repository_git_status_output, types::DesktopLocalRepositoryGitStatus,
};

/// Local repository git status.
pub(crate) fn local_repository_git_status(
    app_data_dir: &Path,
    repository_url: &str,
) -> Result<DesktopLocalRepositoryGitStatus, String> {
    let (repository_url, repository_path) =
        resolve_local_repository_path(app_data_dir, repository_url)?;
    let output = run_read_git_command(
        &repository_path,
        &["status", "--porcelain=v1", "--branch"],
        "failed to start git status",
        "git status failed",
    )?;
    let last_commit = local_repository_last_commit(&repository_path);

    Ok(parse_local_repository_git_status_output(
        repository_url,
        repository_path,
        last_commit,
        &String::from_utf8_lossy(&output.stdout),
    ))
}
