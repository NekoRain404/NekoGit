use tauri::Url;

use super::github::normalize_dashboard_github_url;

pub(super) fn normalize_nekogit_deep_link_url(value: &str) -> Option<String> {
    if value.chars().any(char::is_control) {
        return None;
    }

    let value = value.trim();
    let url: Url = value.parse().ok()?;
    if url.scheme() != "nekogit" || url.host_str() != Some("open") {
        return None;
    }

    if !matches!(url.path(), "" | "/") {
        return None;
    }

    url.query_pairs()
        .find(|(key, _)| key == "url")
        .and_then(|(_, target_url)| normalize_dashboard_github_url(&target_url))
}

#[cfg(test)]
mod tests {
    use super::super::activation::normalize_launch_target_url;

    #[test]
    fn normalizes_nekogit_deep_links_to_github_targets() {
        assert_eq!(
            normalize_launch_target_url(
                "nekogit://open?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo%2Fpull%2F7%2Ffiles%23diff-abc"
            ),
            Some("https://github.com/owner/repo/pull/7/files#diff-abc".to_owned())
        );
        assert_eq!(
            normalize_launch_target_url("nekogit://open?url=https://github.com/owner/repo"),
            Some("https://github.com/owner/repo".to_owned())
        );
    }

    #[test]
    fn rejects_invalid_nekogit_deep_links() {
        assert_eq!(
            normalize_launch_target_url(
                "nekogit://open?url=https%3A%2F%2Fexample.com%2Fowner%2Frepo"
            ),
            None
        );
        assert_eq!(
            normalize_launch_target_url(
                "nekogit://open?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo%0A"
            ),
            None
        );
        assert_eq!(
            normalize_launch_target_url(
                "nekogit://settings?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo"
            ),
            None
        );
        assert_eq!(
            normalize_launch_target_url(
                "nekogit://open/extra?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo"
            ),
            None
        );
    }
}
