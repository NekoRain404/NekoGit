//! Changed file list parsing for Local git repository operations / Read-only git queries.

use std::path::Path;

use super::git::{resolve_local_repository_path, run_read_git_command};
use crate::local_repository::{
    parse::parse_local_repository_changed_files_output, types::DesktopLocalRepositoryChangedFiles,
};

/// Local repository changed files.
pub(crate) fn local_repository_changed_files(
    app_data_dir: &Path,
    repository_url: &str,
    limit: u32,
) -> Result<DesktopLocalRepositoryChangedFiles, String> {
    let (repository_url, repository_path) =
        resolve_local_repository_path(app_data_dir, repository_url)?;
    let limit = limit.clamp(1, 100) as usize;
    let output = run_read_git_command(
        &repository_path,
        &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
        "failed to start git status",
        "git status failed",
    )?;

    Ok(DesktopLocalRepositoryChangedFiles {
        repository_url,
        repository_path,
        files: parse_local_repository_changed_files_output(&output.stdout, limit),
    })
}
