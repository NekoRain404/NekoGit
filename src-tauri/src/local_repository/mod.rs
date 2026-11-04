//! Local Git repository safety layer.
//! Path validation, read/write operations, diff generation, and clone URL normalization.
mod diff;
mod parse;
mod paths;
mod process;
mod read;
mod storage;
mod types;
mod url;
mod write;

pub(crate) use diff::local_repository_file_diff;
pub(crate) use paths::local_repository_path_status;
pub(crate) use read::{
    local_repository_branches, local_repository_changed_files, local_repository_commit_history,
    local_repository_git_status,
};
pub(crate) use storage::{local_repository_status, remember_existing_local_repository};
pub(crate) use types::{
    DesktopCloneRepositoryResult, DesktopLocalRepositoryBranches,
    DesktopLocalRepositoryChangedFiles, DesktopLocalRepositoryCommitHistory,
    DesktopLocalRepositoryFileDiff, DesktopLocalRepositoryGitStatus,
    DesktopLocalRepositoryPathStatus, DesktopLocalRepositoryStatus,
};
pub(crate) use write::{
    checkout_remote_local_repository_branch, clone_github_repository,
    commit_local_repository_changes, create_local_repository_branch, fetch_local_repository,
    pull_local_repository, push_local_repository, stash_local_repository_changes,
    switch_local_repository_branch,
};
