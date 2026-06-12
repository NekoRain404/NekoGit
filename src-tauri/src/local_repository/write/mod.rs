//! Git write operations: clone, sync (fetch/pull/push), branch management, commit, and stash.
mod branches;
mod changes;
mod clone;
mod git;
mod sync;

pub(crate) use branches::{
    checkout_remote_local_repository_branch, create_local_repository_branch,
    switch_local_repository_branch,
};
pub(crate) use changes::{commit_local_repository_changes, stash_local_repository_changes};
pub(crate) use clone::clone_github_repository;
pub(crate) use sync::{fetch_local_repository, pull_local_repository, push_local_repository};
