//! Tauri IPC commands that delegate local Git repository operations to blocking tasks.

mod adopt;
mod branches;
mod changes;
mod clone;
mod open;
mod read;
mod sync;

pub(crate) use adopt::desktop_remember_local_repository;
pub(crate) use branches::{
    desktop_checkout_remote_local_repository_branch, desktop_create_local_repository_branch,
    desktop_delete_local_repository_branch, desktop_switch_local_repository_branch,
};
pub(crate) use changes::{
    desktop_commit_local_repository_changes, desktop_pop_local_repository_stash,
    desktop_stash_local_repository_changes,
};
pub(crate) use clone::desktop_clone_repository;
pub(crate) use open::{
    desktop_open_local_repository, desktop_open_local_repository_path,
    desktop_open_local_repository_terminal,
};
pub(crate) use read::{
    desktop_local_repository_branches, desktop_local_repository_changed_files,
    desktop_local_repository_commit_history, desktop_local_repository_file_diff,
    desktop_local_repository_git_status, desktop_local_repository_stashes,
    desktop_local_repository_status,
};
pub(crate) use sync::{
    desktop_fetch_local_repository, desktop_pull_local_repository, desktop_push_local_repository,
};
