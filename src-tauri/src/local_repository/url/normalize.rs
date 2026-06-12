//! Path normalization for Local git repository operations / Repository URL handling.

use tauri::Url;

use crate::local_repository::url::reserved::is_reserved_github_web_owner_segment;

/// Normalizes the input.
pub(crate) fn normalize_github_repository_clone_url(value: &str) -> Option<String> {
    if value.chars().any(char::is_control) {
        return None;
    }

    let value = value.trim();
    let url: Url = value.parse().ok()?;
    if url.scheme() != "https" || !matches!(url.host_str(), Some("github.com" | "www.github.com")) {
        return None;
    }

    if url.query().is_some() || url.fragment().is_some() {
        return None;
    }

    let segments = url_path_segments(&url);
    let owner = segments.first().copied()?;
    let repo = segments.get(1).copied()?;
    if segments.len() != 2 || is_reserved_github_web_owner_segment(owner) {
        return None;
    }

    let repo_name = repo.strip_suffix(".git")?;
    if repo_name.is_empty() || repo_name == "." || repo_name == ".." {
        return None;
    }

    Some(format!("https://github.com/{owner}/{repo_name}.git"))
}

fn url_path_segments(url: &Url) -> Vec<&str> {
    url.path_segments()
        .map(|segments| segments.filter(|segment| !segment.is_empty()).collect())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_github_repository_clone_urls() {
        assert_eq!(
            normalize_github_repository_clone_url(" https://github.com/owner/repo.git "),
            Some("https://github.com/owner/repo.git".to_owned())
        );
        assert_eq!(
            normalize_github_repository_clone_url("https://www.github.com/owner/repo.git"),
            Some("https://github.com/owner/repo.git".to_owned())
        );
        assert_eq!(
            normalize_github_repository_clone_url("https://github.com/owner/repo"),
            None
        );
        assert_eq!(
            normalize_github_repository_clone_url("https://github.com/settings/tokens.git"),
            None
        );
        assert_eq!(
            normalize_github_repository_clone_url("https://example.com/owner/repo.git"),
            None
        );
        assert_eq!(
            normalize_github_repository_clone_url("https://github.com/owner/repo.git\n"),
            None
        );
    }
}
