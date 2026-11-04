//! Read-only Git queries: status, branches, changed files, and commit history.
mod branches;
mod changed_files;
mod commits;
mod git;
mod stashes;
mod status;

pub(crate) use branches::local_repository_branches;
pub(crate) use changed_files::local_repository_changed_files;
pub(crate) use commits::local_repository_commit_history;
pub(crate) use stashes::local_repository_stashes;
pub(crate) use status::local_repository_git_status;
