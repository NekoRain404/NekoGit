//! Tauri IPC command handlers for GitHub, local repository, runtime, and window menu operations.

mod github;
mod local_repository;
mod runtime;
mod window_menu;

pub(crate) use github::{
    desktop_open_github, desktop_open_github_url, desktop_read_github_cli_token,
};
pub(crate) use local_repository::{
    desktop_checkout_remote_local_repository_branch, desktop_clone_repository,
    desktop_commit_local_repository_changes, desktop_create_local_repository_branch,
    desktop_fetch_local_repository, desktop_local_repository_branches,
    desktop_local_repository_changed_files, desktop_local_repository_commit_history,
    desktop_local_repository_file_diff, desktop_local_repository_git_status,
    desktop_local_repository_status, desktop_open_local_repository,
    desktop_open_local_repository_path, desktop_open_local_repository_terminal,
    desktop_pull_local_repository, desktop_push_local_repository,
    desktop_stash_local_repository_changes, desktop_switch_local_repository_branch,
};
pub(crate) use runtime::{
    desktop_autostart_status, desktop_diagnostics_report, desktop_open_app_data,
    desktop_open_server_log, desktop_runtime_info, desktop_server_status,
    desktop_set_autostart_enabled,
};
pub(crate) use window_menu::{
    desktop_restart_bundled_server, desktop_set_current_github_state, desktop_set_navigation_state,
    desktop_set_review_state, desktop_set_unread_count, desktop_set_window_title,
    desktop_show_window,
};
