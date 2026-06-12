use tauri::Url;

const GITHUB_WEB_RESERVED_OWNER_SEGMENTS: &[&str] = &[
    "apps",
    "codespaces",
    "collections",
    "dashboard",
    "enterprise",
    "explore",
    "features",
    "gist",
    "issues",
    "join",
    "login",
    "marketplace",
    "new",
    "notifications",
    "orgs",
    "organizations",
    "pricing",
    "pulls",
    "search",
    "settings",
    "sponsors",
    "topics",
    "trending",
];
const GITHUB_WEB_FILE_SEGMENTS: &[&str] = &["blob", "raw"];

fn is_supported_github_launch_url(url: &Url) -> bool {
    if url.scheme() != "https" {
        return false;
    }

    matches!(
        url.host_str(),
        Some("github.com" | "www.github.com" | "api.github.com" | "raw.githubusercontent.com")
    )
}

pub(crate) fn normalize_supported_github_url(value: &str) -> Option<String> {
    if value.chars().any(char::is_control) {
        return None;
    }

    let value = value.trim();
    let url: Url = value.parse().ok()?;
    is_supported_github_launch_url(&url).then(|| url.to_string())
}

fn url_path_segments(url: &Url) -> Vec<&str> {
    url.path_segments()
        .map(|segments| segments.filter(|segment| !segment.is_empty()).collect())
        .unwrap_or_default()
}

fn is_positive_number_segment(value: Option<&&str>) -> bool {
    value
        .and_then(|value| value.parse::<u64>().ok())
        .map(|value| value > 0)
        .unwrap_or(false)
}

fn is_reserved_github_web_owner_segment(value: &str) -> bool {
    GITHUB_WEB_RESERVED_OWNER_SEGMENTS
        .iter()
        .any(|segment| segment.eq_ignore_ascii_case(value))
}

fn is_nekogit_dashboard_web_target(url: &Url) -> bool {
    let segments = url_path_segments(url);
    let Some(owner) = segments.first() else {
        return false;
    };
    if segments.get(1).is_none() {
        return false;
    }

    match segments.get(2).copied() {
        None => !is_reserved_github_web_owner_segment(owner),
        Some("issues" | "discussions") => is_positive_number_segment(segments.get(3)),
        Some("pull") => is_positive_number_segment(segments.get(3)),
        Some("tree") => segments.len() >= 4,
        Some(kind) if GITHUB_WEB_FILE_SEGMENTS.contains(&kind) => segments.len() >= 5,
        Some(_) => false,
    }
}

fn is_nekogit_dashboard_api_target(url: &Url) -> bool {
    let segments = url_path_segments(url);
    if segments.first().copied() != Some("repos")
        || segments.get(1).is_none()
        || segments.get(2).is_none()
    {
        return false;
    }

    match segments.get(3).copied() {
        None => true,
        Some("issues" | "pulls" | "discussions") => is_positive_number_segment(segments.get(4)),
        Some(_) => false,
    }
}

fn is_nekogit_dashboard_raw_target(url: &Url) -> bool {
    url_path_segments(url).len() >= 4
}

pub(crate) fn is_nekogit_dashboard_github_target_url(url: &Url) -> bool {
    if url.scheme() != "https" {
        return false;
    }

    match url.host_str() {
        Some("github.com" | "www.github.com") => is_nekogit_dashboard_web_target(url),
        Some("api.github.com") => is_nekogit_dashboard_api_target(url),
        Some("raw.githubusercontent.com") => is_nekogit_dashboard_raw_target(url),
        _ => false,
    }
}

pub(super) fn normalize_dashboard_github_url(value: &str) -> Option<String> {
    if value.chars().any(char::is_control) {
        return None;
    }

    let value = value.trim();
    let url: Url = value.parse().ok()?;
    is_nekogit_dashboard_github_target_url(&url).then(|| url.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_supported_github_urls_for_external_open() {
        assert_eq!(
            normalize_supported_github_url(" https://github.com/owner/repo "),
            Some("https://github.com/owner/repo".to_owned())
        );
        assert_eq!(
            normalize_supported_github_url("https://api.github.com/repos/owner/repo/issues/42"),
            Some("https://api.github.com/repos/owner/repo/issues/42".to_owned())
        );
        assert_eq!(
            normalize_supported_github_url("http://github.com/owner/repo"),
            None
        );
        assert_eq!(
            normalize_supported_github_url("https://example.com/owner/repo"),
            None
        );
        assert_eq!(
            normalize_supported_github_url("https://github.com/owner/repo\n"),
            None
        );
    }

    #[test]
    fn normalizes_dashboard_github_urls_for_in_app_navigation() {
        assert_eq!(
            normalize_dashboard_github_url(" https://github.com/owner/repo "),
            Some("https://github.com/owner/repo".to_owned())
        );
        assert_eq!(
            normalize_dashboard_github_url("https://github.com/owner/repo/pull/7/files#diff-abc"),
            Some("https://github.com/owner/repo/pull/7/files#diff-abc".to_owned())
        );
        assert_eq!(
            normalize_dashboard_github_url("https://github.com/owner/repo/tree/main"),
            Some("https://github.com/owner/repo/tree/main".to_owned())
        );
        assert_eq!(
            normalize_dashboard_github_url("https://api.github.com/repos/owner/repo/issues/42"),
            Some("https://api.github.com/repos/owner/repo/issues/42".to_owned())
        );
        assert_eq!(
            normalize_dashboard_github_url(
                "https://raw.githubusercontent.com/owner/repo/main/assets/logo.png"
            ),
            Some("https://raw.githubusercontent.com/owner/repo/main/assets/logo.png".to_owned())
        );
    }

    #[test]
    fn leaves_github_site_urls_that_do_not_map_to_dashboard_for_browser() {
        assert_eq!(
            normalize_dashboard_github_url("https://github.com/settings/tokens"),
            None
        );
        assert_eq!(
            normalize_dashboard_github_url("https://github.com/search?q=nekogit"),
            None
        );
        assert_eq!(
            normalize_dashboard_github_url("https://github.com/owner/repo/actions"),
            None
        );
        assert_eq!(
            normalize_dashboard_github_url("https://api.github.com/rate_limit"),
            None
        );
        assert_eq!(
            normalize_dashboard_github_url("https://raw.githubusercontent.com/owner/repo/main"),
            None
        );
    }
}
