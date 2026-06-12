//! Commit log parsing for Local git repository operations / Output parsing.

use crate::local_repository::types::DesktopLocalRepositoryGitCommit;

/// Parses the input.
pub(crate) fn parse_local_repository_git_commit_output(
    output: &str,
) -> Option<DesktopLocalRepositoryGitCommit> {
    let value = output.trim_end_matches(['\r', '\n']);
    if value.is_empty() {
        return None;
    }

    let mut parts = value.splitn(6, '\0');
    let oid = parts.next()?.trim();
    let short_oid = parts.next()?.trim();
    let author_name = parts.next()?.trim();
    let author_email = parts.next()?.trim();
    let authored_at = parts.next()?.trim().parse::<u64>().ok()?;
    let summary = parts.next()?.trim();

    if oid.is_empty() || short_oid.is_empty() {
        return None;
    }

    Some(DesktopLocalRepositoryGitCommit {
        oid: oid.to_owned(),
        short_oid: short_oid.to_owned(),
        author_name: author_name.to_owned(),
        author_email: author_email.to_owned(),
        authored_at,
        summary: summary.to_owned(),
    })
}

/// Parses the input.
pub(crate) fn parse_local_repository_git_commit_history_output(
    output: &str,
) -> Vec<DesktopLocalRepositoryGitCommit> {
    output
        .split('\x1e')
        .filter_map(parse_local_repository_git_commit_output)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_local_repository_git_commit_output() {
        let commit = parse_local_repository_git_commit_output(
            "0123456789abcdef0123456789abcdef01234567\0\
             0123456\0\
             Neko Rain\0\
             neko@example.com\0\
             1780000000\0\
             Improve desktop Git workflow\n",
        )
        .unwrap();

        assert_eq!(commit.oid, "0123456789abcdef0123456789abcdef01234567");
        assert_eq!(commit.short_oid, "0123456");
        assert_eq!(commit.author_name, "Neko Rain");
        assert_eq!(commit.author_email, "neko@example.com");
        assert_eq!(commit.authored_at, 1_780_000_000);
        assert_eq!(commit.summary, "Improve desktop Git workflow");
    }

    #[test]
    fn parses_local_repository_git_commit_history_output() {
        let commits = parse_local_repository_git_commit_history_output(
            "0123456789abcdef0123456789abcdef01234567\0\
             0123456\0\
             Neko Rain\0\
             neko@example.com\0\
             1780000000\0\
             Improve desktop Git workflow\x1e\
             fedcba9876543210fedcba9876543210fedcba98\0\
             fedcba9\0\
             Codex\0\
             codex@example.com\0\
             1770000000\0\
             Add Linux client shell\x1e\n",
        );

        assert_eq!(commits.len(), 2);
        assert_eq!(commits[0].short_oid, "0123456");
        assert_eq!(commits[0].summary, "Improve desktop Git workflow");
        assert_eq!(commits[1].short_oid, "fedcba9");
        assert_eq!(commits[1].author_name, "Codex");
        assert_eq!(commits[1].authored_at, 1_770_000_000);
    }
}
