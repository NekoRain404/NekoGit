/// Desktop command wrappers exposing Tauri IPC calls for app data, diagnostics, GitHub links, server control, and window state.
import { invokeDesktopCommand } from './invoke';
import type {
  DesktopCurrentGitHubState,
  DesktopNavigationState,
  DesktopReviewState,
} from './types';

/** Open the application data directory in the system file manager. */
export const openAppData = async () => {
  await invokeDesktopCommand<void>('desktop_open_app_data');
};

/** Generate and return a diagnostics report string. */
export const createDiagnosticsReport = async () => {
  return invokeDesktopCommand<string>('desktop_diagnostics_report');
};

/** Open the bundled server log file. */
export const openServerLog = async () => {
  await invokeDesktopCommand<void>('desktop_open_server_log');
};

/** Open the GitHub homepage in the default browser. */
export const openGithub = async () => {
  await invokeDesktopCommand<void>('desktop_open_github');
};

/** Open an arbitrary GitHub URL in the default browser. */
export const openGithubUrl = async (url: string) => {
  await invokeDesktopCommand<void>('desktop_open_github_url', {
    url,
  });
};

/** Read a GitHub CLI authentication token from the desktop keychain. */
export const readGithubCliToken = async () => {
  return invokeDesktopCommand<string>('desktop_read_github_cli_token');
};

/** Set the unread notification badge count on the desktop dock/taskbar. */
export const setUnreadCount = async (count: number) => {
  await invokeDesktopCommand<void>('desktop_set_unread_count', {
    count: Math.max(0, Math.trunc(count)),
  });
};

/** Update the native window title bar text. */
export const setWindowTitle = async (title: string) => {
  await invokeDesktopCommand<void>('desktop_set_window_title', {
    title,
  });
};

/** Sync back/forward navigation capability to the desktop window chrome. */
export const setNavigationState = async (state: DesktopNavigationState) => {
  await invokeDesktopCommand<void>('desktop_set_navigation_state', {
    state,
  });
};

/** Push the current PR review toolbar state to the desktop shell. */
export const setReviewState = async (state: DesktopReviewState) => {
  await invokeDesktopCommand<void>('desktop_set_review_state', {
    state,
  });
};

/** Notify the desktop shell about the current GitHub context. */
export const setCurrentGitHubState = async (state: DesktopCurrentGitHubState) => {
  await invokeDesktopCommand<void>('desktop_set_current_github_state', {
    state,
  });
};

/** Bring the desktop window to the foreground. */
export const showWindow = async () => {
  await invokeDesktopCommand<void>('desktop_show_window');
};

/** Restart the bundled backend server process. */
export const restartBundledServer = async () => {
  await invokeDesktopCommand<void>('desktop_restart_bundled_server');
};
