//! Command input normalization for Local git repository operations / Output parsing.

use crate::local_repository::types::MAX_LOCAL_REPOSITORY_COMMIT_MESSAGE_CHARS;

/// Normalizes the input.
pub(crate) fn normalize_local_branch_name(value: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() {
        return Err("branch name must not be empty".to_owned());
    }
    if value.chars().any(|character| {
        character.is_control()
            || character.is_whitespace()
            || matches!(character, '~' | '^' | ':' | '?' | '*' | '[')
    }) {
        return Err("branch name contains unsupported characters".to_owned());
    }
    if value.starts_with('-')
        || value.starts_with('/')
        || value.ends_with('/')
        || value.ends_with('.')
        || value.contains("..")
        || value.contains("//")
        || value.contains(".lock")
        || value.contains('\\')
        || value.contains("@{")
        || value == "@"
    {
        return Err("branch name is not supported".to_owned());
    }

    Ok(value.to_owned())
}

/// Normalizes the input.
pub(crate) fn normalize_origin_remote_branch_name(value: &str) -> Result<(String, String), String> {
    let value = value.trim();
    let local_name = value
        .strip_prefix("origin/")
        .ok_or_else(|| "remote branch must be under origin".to_owned())?;
    if local_name == "HEAD" {
        return Err("remote HEAD cannot be checked out as a branch".to_owned());
    }

    let local_name = normalize_local_branch_name(local_name)?;
    Ok((format!("origin/{local_name}"), local_name))
}

/// Normalizes the input.
pub(crate) fn normalize_local_commit_message(value: &str) -> Result<String, String> {
    let value = value.replace("\r\n", "\n").replace('\r', "\n");
    let value = value.trim();
    if value.is_empty() {
        return Err("commit message must not be empty".to_owned());
    }
    if value.chars().count() > MAX_LOCAL_REPOSITORY_COMMIT_MESSAGE_CHARS {
        return Err("commit message is too long".to_owned());
    }
    if value
        .chars()
        .any(|character| character.is_control() && !matches!(character, '\n' | '\t'))
    {
        return Err("commit message contains unsupported control characters".to_owned());
    }

    Ok(value.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_local_branch_names_safely() {
        assert_eq!(
            normalize_local_branch_name(" feature/local ").unwrap(),
            "feature/local"
        );
        assert_eq!(
            normalize_local_branch_name("release/1.0.0").unwrap(),
            "release/1.0.0"
        );

        for branch_name in [
            "",
            "-option",
            "feature branch",
            "feature..bad",
            "feature.lock",
            "feature/@{bad}",
            "feature\\bad",
            "feature?bad",
            "feature*bad",
            "/feature",
            "feature/",
            "feature.",
            "@",
        ] {
            assert!(
                normalize_local_branch_name(branch_name).is_err(),
                "branch name `{branch_name}` should be rejected"
            );
        }
    }

    #[test]
    fn normalizes_origin_remote_branch_names_safely() {
        assert_eq!(
            normalize_origin_remote_branch_name(" origin/feature/remote ").unwrap(),
            (
                "origin/feature/remote".to_owned(),
                "feature/remote".to_owned()
            )
        );

        for branch_name in [
            "main",
            "origin/HEAD",
            "origin/feature branch",
            "origin/feature..bad",
            "upstream/feature",
            "origin/-option",
        ] {
            assert!(
                normalize_origin_remote_branch_name(branch_name).is_err(),
                "remote branch name `{branch_name}` should be rejected"
            );
        }
    }

    #[test]
    fn normalizes_local_commit_messages_safely() {
        assert_eq!(
            normalize_local_commit_message("  Improve desktop commits\r\n\r\nBody\tline  ")
                .unwrap(),
            "Improve desktop commits\n\nBody\tline"
        );

        for message in ["", "  \n\t  ", "bad\u{0}message", "bad\u{7}message"] {
            assert!(
                normalize_local_commit_message(message).is_err(),
                "commit message `{message}` should be rejected"
            );
        }
    }
}
