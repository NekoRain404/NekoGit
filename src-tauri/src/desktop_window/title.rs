//! Window title management for Window management.

use tauri::{Manager, Runtime};

use super::constants::{DEFAULT_WINDOW_TITLE, MAIN_WINDOW_LABEL, MAX_DESKTOP_WINDOW_TITLE_CHARS};

fn normalize_desktop_window_title(value: &str) -> String {
    let normalized = value.split_whitespace().collect::<Vec<_>>().join(" ");
    let normalized = normalized.trim_matches(['-', '|', ' ']);
    let normalized = if normalized.is_empty() {
        DEFAULT_WINDOW_TITLE
    } else {
        normalized
    };

    normalized
        .chars()
        .filter(|character| !character.is_control())
        .take(MAX_DESKTOP_WINDOW_TITLE_CHARS)
        .collect()
}

/// Updates the resource.
pub(crate) fn update_desktop_window_title<R: Runtime>(
    app: &tauri::AppHandle<R>,
    title: &str,
) -> Result<(), String> {
    let title = normalize_desktop_window_title(title);

    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        window
            .set_title(&title)
            .map_err(|error| format!("failed to update NekoGit window title: {error}"))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_desktop_window_titles() {
        assert_eq!(normalize_desktop_window_title(""), DEFAULT_WINDOW_TITLE);
        assert_eq!(
            normalize_desktop_window_title("  Repo\nIssue\t- NekoGit  "),
            "Repo Issue - NekoGit"
        );
        assert_eq!(
            normalize_desktop_window_title("Title\u{7}With\u{0}Controls"),
            "TitleWithControls"
        );
        assert_eq!(
            normalize_desktop_window_title(&"a".repeat(MAX_DESKTOP_WINDOW_TITLE_CHARS + 1)).len(),
            MAX_DESKTOP_WINDOW_TITLE_CHARS
        );
    }
}
