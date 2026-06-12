//! Frontend notification commands for Desktop menu action handlers.

use tauri::Runtime;

use crate::{
    desktop_events::{
        emit_clone_current_repository, emit_copy_current_github,
        emit_copy_current_repository_clone_url, emit_desktop_command, emit_desktop_navigation,
        emit_open_current_github, emit_open_github_from_clipboard, emit_open_local_repository,
        DesktopCommandAction, DesktopNavigationAction,
    },
    desktop_menu::{
        MENU_CLONE_CURRENT_REPOSITORY, MENU_COPY_CURRENT_GITHUB,
        MENU_COPY_CURRENT_REPOSITORY_CLONE_URL, MENU_MANAGE_VIEWS,
        MENU_MARK_ALL_NOTIFICATIONS_READ, MENU_MARK_VISIBLE_NOTIFICATIONS_READ, MENU_NAVIGATE_BACK,
        MENU_NAVIGATE_FORWARD, MENU_NAVIGATE_HOME, MENU_OPEN_CURRENT_GITHUB,
        MENU_OPEN_GITHUB_FROM_CLIPBOARD, MENU_OPEN_LOCAL_REPOSITORY, MENU_OPEN_NOTIFICATIONS,
        MENU_OPEN_SETTINGS, MENU_QUICK_OPEN, MENU_REFRESH_CURRENT_VIEW, MENU_REVIEW_NEXT_FILE,
        MENU_REVIEW_NEXT_UNVIEWED_FILE, MENU_REVIEW_PREVIOUS_FILE,
        MENU_REVIEW_TOGGLE_CURRENT_FILE_VIEWED, MENU_REVIEW_TOGGLE_FILE_SIDEBAR,
        MENU_REVIEW_TOGGLE_REVIEW_PANEL,
    },
    desktop_window::show_main_window,
};

fn show_and_emit_desktop_command<R: Runtime>(
    app: &tauri::AppHandle<R>,
    action: DesktopCommandAction,
) -> Result<(), String> {
    show_main_window(app).and_then(|_| emit_desktop_command(app, action))
}

fn emit_after_showing_window<R: Runtime>(
    app: &tauri::AppHandle<R>,
    emit: impl FnOnce(&tauri::AppHandle<R>) -> Result<(), String>,
) {
    if let Err(error) = show_main_window(app).and_then(|_| emit(app)) {
        eprintln!("{error}");
    }
}

fn emit_desktop_command_after_showing_window<R: Runtime>(
    app: &tauri::AppHandle<R>,
    action: DesktopCommandAction,
) {
    if let Err(error) = show_and_emit_desktop_command(app, action) {
        eprintln!("{error}");
    }
}

pub(super) fn handle_frontend_menu_event<R: Runtime>(
    app: &tauri::AppHandle<R>,
    item_id: &str,
) -> bool {
    match item_id {
        MENU_NAVIGATE_BACK => {
            if let Err(error) = emit_desktop_navigation(app, DesktopNavigationAction::Back) {
                eprintln!("{error}");
            }
        }
        MENU_NAVIGATE_FORWARD => {
            if let Err(error) = emit_desktop_navigation(app, DesktopNavigationAction::Forward) {
                eprintln!("{error}");
            }
        }
        MENU_NAVIGATE_HOME => {
            if let Err(error) = emit_desktop_navigation(app, DesktopNavigationAction::Home) {
                eprintln!("{error}");
            }
        }
        MENU_REFRESH_CURRENT_VIEW => {
            emit_desktop_command_after_showing_window(
                app,
                DesktopCommandAction::RefreshCurrentView,
            );
        }
        MENU_OPEN_NOTIFICATIONS => {
            emit_desktop_command_after_showing_window(app, DesktopCommandAction::OpenNotifications);
        }
        MENU_MARK_VISIBLE_NOTIFICATIONS_READ => {
            emit_desktop_command_after_showing_window(
                app,
                DesktopCommandAction::MarkVisibleNotificationsRead,
            );
        }
        MENU_MARK_ALL_NOTIFICATIONS_READ => {
            emit_desktop_command_after_showing_window(
                app,
                DesktopCommandAction::MarkAllNotificationsRead,
            );
        }
        MENU_OPEN_SETTINGS => {
            emit_desktop_command_after_showing_window(app, DesktopCommandAction::OpenSettings);
        }
        MENU_MANAGE_VIEWS => {
            emit_desktop_command_after_showing_window(app, DesktopCommandAction::ManageViews);
        }
        MENU_QUICK_OPEN => {
            emit_desktop_command_after_showing_window(app, DesktopCommandAction::QuickOpen);
        }
        MENU_REVIEW_PREVIOUS_FILE => {
            emit_desktop_command_after_showing_window(
                app,
                DesktopCommandAction::ReviewPreviousFile,
            );
        }
        MENU_REVIEW_NEXT_FILE => {
            emit_desktop_command_after_showing_window(app, DesktopCommandAction::ReviewNextFile);
        }
        MENU_REVIEW_NEXT_UNVIEWED_FILE => {
            emit_desktop_command_after_showing_window(
                app,
                DesktopCommandAction::ReviewNextUnviewedFile,
            );
        }
        MENU_REVIEW_TOGGLE_CURRENT_FILE_VIEWED => {
            emit_desktop_command_after_showing_window(
                app,
                DesktopCommandAction::ReviewToggleCurrentFileViewed,
            );
        }
        MENU_REVIEW_TOGGLE_FILE_SIDEBAR => {
            emit_desktop_command_after_showing_window(
                app,
                DesktopCommandAction::ReviewToggleFileSidebar,
            );
        }
        MENU_REVIEW_TOGGLE_REVIEW_PANEL => {
            emit_desktop_command_after_showing_window(
                app,
                DesktopCommandAction::ReviewToggleReviewPanel,
            );
        }
        MENU_OPEN_CURRENT_GITHUB => {
            emit_after_showing_window(app, emit_open_current_github);
        }
        MENU_OPEN_GITHUB_FROM_CLIPBOARD => {
            emit_after_showing_window(app, emit_open_github_from_clipboard);
        }
        MENU_COPY_CURRENT_GITHUB => {
            if let Err(error) = emit_copy_current_github(app) {
                eprintln!("{error}");
            }
        }
        MENU_COPY_CURRENT_REPOSITORY_CLONE_URL => {
            if let Err(error) = emit_copy_current_repository_clone_url(app) {
                eprintln!("{error}");
            }
        }
        MENU_CLONE_CURRENT_REPOSITORY => {
            emit_after_showing_window(app, emit_clone_current_repository);
        }
        MENU_OPEN_LOCAL_REPOSITORY => {
            emit_after_showing_window(app, emit_open_local_repository);
        }
        _ => return false,
    }

    true
}
