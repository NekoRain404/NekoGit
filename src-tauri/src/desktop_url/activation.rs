//! Activation and focus handling for URL routing and handling.

use std::env;

use super::{deep_link::normalize_nekogit_deep_link_url, github::normalize_dashboard_github_url};

#[derive(Debug, PartialEq)]
pub(crate) enum ActivationRequest {
    Show,
    OpenGithubUrl(String),
}

pub(super) fn normalize_launch_target_url(value: &str) -> Option<String> {
    normalize_dashboard_github_url(value).or_else(|| normalize_nekogit_deep_link_url(value))
}

fn launch_target_url_from_args<I, S>(args: I) -> Option<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    args.into_iter()
        .filter_map(|arg| normalize_launch_target_url(arg.as_ref()))
        .next()
}

/// Current launch target url.
pub(crate) fn current_launch_target_url() -> Option<String> {
    launch_target_url_from_args(env::args().skip(1))
}

/// Activation message.
pub(crate) fn activation_message(target_url: Option<&str>) -> String {
    match target_url {
        Some(target_url) => format!("open {target_url}\n"),
        None => "show\n".to_owned(),
    }
}

/// Parses the input.
pub(crate) fn parse_activation_request(value: &str) -> ActivationRequest {
    let value = value.trim();

    if let Some(raw_url) = value.strip_prefix("open ") {
        if let Some(url) = normalize_launch_target_url(raw_url) {
            return ActivationRequest::OpenGithubUrl(url);
        }
    }

    ActivationRequest::Show
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_launch_target_urls_from_args() {
        assert_eq!(
            launch_target_url_from_args([
                "--ignored",
                "https://github.com/owner/repo/pull/7/files#diff-abc",
            ]),
            Some("https://github.com/owner/repo/pull/7/files#diff-abc".to_owned())
        );
        assert_eq!(
            launch_target_url_from_args(["http://github.com/owner/repo", "https://example.com"]),
            None
        );
        assert_eq!(
            launch_target_url_from_args([
                "https://raw.githubusercontent.com/owner/repo/main/a.txt"
            ]),
            Some("https://raw.githubusercontent.com/owner/repo/main/a.txt".to_owned())
        );
        assert_eq!(
            launch_target_url_from_args([
                "--ignored",
                "nekogit://open?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo%2Fissues%2F42",
            ]),
            Some("https://github.com/owner/repo/issues/42".to_owned())
        );
    }

    #[test]
    fn parses_activation_requests() {
        assert_eq!(parse_activation_request("show\n"), ActivationRequest::Show);
        assert_eq!(
            parse_activation_request("open https://github.com/owner/repo\n"),
            ActivationRequest::OpenGithubUrl("https://github.com/owner/repo".to_owned())
        );
        assert_eq!(
            parse_activation_request(
                "open nekogit://open?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo\n"
            ),
            ActivationRequest::OpenGithubUrl("https://github.com/owner/repo".to_owned())
        );
        assert_eq!(
            parse_activation_request("open https://example.com/owner/repo\n"),
            ActivationRequest::Show
        );
    }
}
