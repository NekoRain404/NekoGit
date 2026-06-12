//! Wire-format event names shared between the Rust backend and the frontend listener plugins.

// Keep these event names aligned with the desktop listener plugins under app/plugins.
pub(super) const DESKTOP_COMMAND_EVENT: &str = "nekogit:desktop-command";
pub(super) const DESKTOP_NAVIGATION_EVENT: &str = "nekogit:desktop-navigation";
pub(super) const DESKTOP_OPEN_CURRENT_GITHUB_EVENT: &str = "nekogit:open-current-github";
pub(super) const DESKTOP_OPEN_GITHUB_FROM_CLIPBOARD_EVENT: &str =
    "nekogit:open-github-from-clipboard";
pub(super) const DESKTOP_COPY_CURRENT_GITHUB_EVENT: &str = "nekogit:copy-current-github";
pub(super) const DESKTOP_COPY_CURRENT_REPOSITORY_CLONE_URL_EVENT: &str =
    "nekogit:copy-current-repository-clone-url";
pub(super) const DESKTOP_CLONE_CURRENT_REPOSITORY_EVENT: &str = "nekogit:clone-current-repository";
pub(super) const DESKTOP_OPEN_LOCAL_REPOSITORY_EVENT: &str = "nekogit:open-local-repository";
