//! Typed event emitters and payloads for frontend-desktop IPC communication.

mod emit;
mod names;
mod payloads;

pub(crate) use emit::{
    emit_clone_current_repository, emit_copy_current_github,
    emit_copy_current_repository_clone_url, emit_desktop_command, emit_desktop_navigation,
    emit_open_current_github, emit_open_github_from_clipboard, emit_open_local_repository,
};
pub(crate) use payloads::{DesktopCommandAction, DesktopNavigationAction};
