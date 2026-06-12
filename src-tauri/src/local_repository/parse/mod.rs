//! Pure Git output parsing and user input normalization for local repository workflows.
mod branches;
mod changed_files;
mod commit;
mod failure;
mod input;
mod status;

pub(crate) use branches::{
    parse_local_repository_branches_output, parse_local_repository_remote_branches_output,
};
pub(crate) use changed_files::parse_local_repository_changed_files_output;
pub(crate) use commit::{
    parse_local_repository_git_commit_history_output, parse_local_repository_git_commit_output,
};
pub(crate) use failure::git_command_failure_details;
pub(crate) use input::{
    normalize_local_branch_name, normalize_local_commit_message,
    normalize_origin_remote_branch_name,
};
pub(crate) use status::parse_local_repository_git_status_output;
