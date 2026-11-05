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
pub(crate) use process::request_git_cancellation;
pub(crate) use read::{
    local_repository_branches, local_repository_changed_files, local_repository_commit_history,
    local_repository_git_status, local_repository_stashes,
};
pub(crate) use storage::{local_repository_status, remember_existing_local_repository};
pub(crate) use types::{
    DesktopCloneRepositoryResult, DesktopLocalRepositoryBranches,
    DesktopLocalRepositoryChangedFiles, DesktopLocalRepositoryCommitHistory,
    DesktopLocalRepositoryFileDiff, DesktopLocalRepositoryGitStatus,
    DesktopLocalRepositoryPathStatus, DesktopLocalRepositoryStashes, DesktopLocalRepositoryStatus,
};
pub(crate) use write::{
    abort_local_repository_rebase, amend_local_repository_commit, apply_local_repository_stash,
    checkout_remote_local_repository_branch, clear_local_repository_stashes,
    clone_github_repository, commit_local_repository_changes, create_local_repository_branch,
    delete_local_repository_branch, fetch_local_repository, pop_local_repository_stash,
    pull_local_repository, push_local_repository, rebase_local_repository,
    stage_local_repository_path, stash_local_repository_changes, switch_local_repository_branch,
    undo_local_repository_commit, unstage_local_repository_path,
};
