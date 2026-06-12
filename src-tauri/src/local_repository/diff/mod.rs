//! Read-only file diff generation via Git, with pathspec and truncation handling.
mod command;
mod pathspec;
mod truncate;
mod untracked;

use std::path::Path;

use crate::local_repository::{
    diff::{
        command::run_git_diff,
        pathspec::git_diff_pathspecs,
        truncate::truncate_text_to_bytes,
        untracked::{is_untracked_repository_file, read_untracked_file_diff},
    },
    paths::{
        normalize_repository_relative_path, repository_relative_path_string,
        validated_repository_file_path,
    },
    storage::local_repository_status,
    types::{
        DesktopLocalRepositoryFileDiff, MAX_LOCAL_REPOSITORY_DIFF_BYTES,
        MIN_LOCAL_REPOSITORY_DIFF_BYTES,
    },
};

pub(crate) fn local_repository_file_diff(
    app_data_dir: &Path,
    repository_url: &str,
    relative_path: &str,
    previous_path: Option<String>,
    max_bytes: u32,
) -> Result<DesktopLocalRepositoryFileDiff, String> {
    let status = local_repository_status(app_data_dir, repository_url)?;
    let Some(repository_path) = status.path.as_deref() else {
        return Err("local repository is not available".to_owned());
    };

    // Only normalized repository-relative paths are passed to Git. This keeps
    // pathspecs inside the remembered repository and prevents shell expansion.
    let normalized_relative_path = normalize_repository_relative_path(relative_path)?;
    if normalized_relative_path.as_os_str().is_empty() {
        return Err("repository path must not be empty".to_owned());
    }
    let relative_path = repository_relative_path_string(&normalized_relative_path);
    let local_path = validated_repository_file_path(repository_path, &normalized_relative_path)?;
    let previous_path = previous_path
        .as_deref()
        .map(normalize_repository_relative_path)
        .transpose()?
        .filter(|path| !path.as_os_str().is_empty())
        .map(|path| repository_relative_path_string(&path));
    let pathspecs = git_diff_pathspecs(&relative_path, previous_path.as_deref());
    let max_bytes = max_bytes.clamp(
        MIN_LOCAL_REPOSITORY_DIFF_BYTES,
        MAX_LOCAL_REPOSITORY_DIFF_BYTES,
    ) as usize;

    let staged_diff = run_git_diff(
        repository_path,
        &[
            "diff",
            "--no-ext-diff",
            "--patch",
            "--find-renames",
            "--color=never",
            "--cached",
        ],
        &pathspecs,
    )?;
    let unstaged_diff = run_git_diff(
        repository_path,
        &[
            "diff",
            "--no-ext-diff",
            "--patch",
            "--find-renames",
            "--color=never",
        ],
        &pathspecs,
    )?;

    let (staged_diff, staged_truncated) = truncate_text_to_bytes(staged_diff, max_bytes);
    let (unstaged_diff, unstaged_truncated) = truncate_text_to_bytes(unstaged_diff, max_bytes);
    let (untracked_diff, untracked_truncated) = if staged_diff.is_empty()
        && unstaged_diff.is_empty()
        && is_untracked_repository_file(repository_path, &relative_path)
    {
        read_untracked_file_diff(&local_path, &relative_path, max_bytes)?
    } else {
        (String::new(), false)
    };

    let empty = staged_diff.is_empty() && unstaged_diff.is_empty() && untracked_diff.is_empty();

    Ok(DesktopLocalRepositoryFileDiff {
        repository_url: status.repository_url,
        repository_path: repository_path.to_owned(),
        path: relative_path,
        previous_path,
        staged_diff,
        unstaged_diff,
        untracked_diff,
        truncated: staged_truncated || unstaged_truncated || untracked_truncated,
        empty,
    })
}
