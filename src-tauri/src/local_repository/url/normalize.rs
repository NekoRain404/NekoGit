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

/// Normalize a Git remote URL from `origin` (HTTPS or common GitHub SSH forms).
pub(crate) fn normalize_github_remote_url(value: &str) -> Option<String> {
    if value.chars().any(char::is_control) {
        return None;
    }

    let value = value.trim();
    let candidate = if let Some(rest) = value.strip_prefix("git@github.com:") {
        format!("https://github.com/{}", rest.trim_start_matches('/'))
    } else if let Some(rest) = value.strip_prefix("ssh://git@github.com/") {
        format!("https://github.com/{rest}")
    } else if let Some(rest) = value.strip_prefix("ssh://git@ssh.github.com:443/") {
        format!("https://github.com/{rest}")
    } else {
        value.to_owned()
    };

    let with_git_suffix = if candidate.ends_with(".git") {
        candidate
    } else {
        format!("{candidate}.git")
    };

    normalize_github_repository_clone_url(&with_git_suffix)
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
    #[test]
    fn normalizes_https_and_ssh_github_remote_urls() {
        assert_eq!(
            normalize_github_remote_url("https://github.com/owner/repo.git"),
            Some("https://github.com/owner/repo.git".to_owned())
        );
        assert_eq!(
            normalize_github_remote_url("https://github.com/owner/repo"),
            Some("https://github.com/owner/repo.git".to_owned())
        );
        assert_eq!(
            normalize_github_remote_url("git@github.com:owner/repo.git"),
            Some("https://github.com/owner/repo.git".to_owned())
        );
        assert_eq!(
            normalize_github_remote_url("ssh://git@github.com/owner/repo.git"),
            Some("https://github.com/owner/repo.git".to_owned())
        );
        assert_eq!(
            normalize_github_remote_url("ssh://git@ssh.github.com:443/owner/repo.git"),
            Some("https://github.com/owner/repo.git".to_owned())
        );
        assert_eq!(
            normalize_github_remote_url("git@example.com:owner/repo.git"),
            None
        );
    }
}
