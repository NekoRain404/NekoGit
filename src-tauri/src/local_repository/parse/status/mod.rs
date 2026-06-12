//! Porcelain status parsing: branch detection, conflict classification, and file-count aggregation.
mod branch;
mod conflict;
mod counts;

use crate::local_repository::types::{
    DesktopLocalRepositoryGitCommit, DesktopLocalRepositoryGitStatus,
};

use branch::parse_local_repository_git_branch_line;
use counts::GitStatusCounts;

pub(super) fn is_unmerged_git_status_pair(status_pair: &str) -> bool {
    conflict::is_unmerged_git_status_pair(status_pair)
}

pub(crate) fn parse_local_repository_git_status_output(
    repository_url: String,
    repository_path: String,
    last_commit: Option<DesktopLocalRepositoryGitCommit>,
    output: &str,
) -> DesktopLocalRepositoryGitStatus {
    let mut branch = None;
    let mut upstream = None;
    let mut ahead = 0;
    let mut behind = 0;
    let mut counts = GitStatusCounts::default();

    for line in output.lines() {
        if line.starts_with("## ") {
            (branch, upstream, ahead, behind) = parse_local_repository_git_branch_line(line);
            continue;
        }

        counts.include_porcelain_line(line);
    }

    DesktopLocalRepositoryGitStatus {
        repository_url,
        repository_path,
        branch,
        upstream,
        last_commit,
        ahead,
        behind,
        staged: counts.staged,
        unstaged: counts.unstaged,
        untracked: counts.untracked,
        conflicted: counts.conflicted,
        clean: counts.is_clean(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_clean_local_repository_git_status() {
        let status = parse_local_repository_git_status_output(
            "https://github.com/owner/repo.git".to_owned(),
            "/tmp/repo".to_owned(),
            None,
            "## main\n",
        );

        assert_eq!(status.branch, Some("main".to_owned()));
        assert_eq!(status.upstream, None);
        assert_eq!(status.last_commit, None);
        assert_eq!(status.ahead, 0);
        assert_eq!(status.behind, 0);
        assert_eq!(status.staged, 0);
        assert_eq!(status.unstaged, 0);
        assert_eq!(status.untracked, 0);
        assert_eq!(status.conflicted, 0);
        assert!(status.clean);
    }

    #[test]
    fn parses_local_repository_git_ahead_behind_and_file_counts() {
        let status = parse_local_repository_git_status_output(
            "https://github.com/owner/repo.git".to_owned(),
            "/tmp/repo".to_owned(),
            Some(DesktopLocalRepositoryGitCommit {
                oid: "0123456789abcdef0123456789abcdef01234567".to_owned(),
                short_oid: "0123456".to_owned(),
                author_name: "Neko Rain".to_owned(),
                author_email: "neko@example.com".to_owned(),
                authored_at: 1_780_000_000,
                summary: "Improve desktop Git workflow".to_owned(),
            }),
            concat!(
                "## main...origin/main [ahead 1, behind 2]\n",
                " M src/lib.rs\n",
                "M  Cargo.toml\n",
                "MM README.md\n",
                "?? new-file.txt\n",
                "UU conflict.txt\n",
                "!! ignored.log\n",
            ),
        );

        assert_eq!(status.branch, Some("main".to_owned()));
        assert_eq!(status.upstream, Some("origin/main".to_owned()));
        assert_eq!(
            status
                .last_commit
                .as_ref()
                .map(|commit| commit.short_oid.as_str()),
            Some("0123456")
        );
        assert_eq!(status.ahead, 1);
        assert_eq!(status.behind, 2);
        assert_eq!(status.staged, 2);
        assert_eq!(status.unstaged, 2);
        assert_eq!(status.untracked, 1);
        assert_eq!(status.conflicted, 1);
        assert!(!status.clean);
    }

    #[test]
    fn parses_local_repository_git_status_before_first_commit() {
        let status = parse_local_repository_git_status_output(
            "https://github.com/owner/repo.git".to_owned(),
            "/tmp/repo".to_owned(),
            None,
            "## No commits yet on trunk\n?? README.md\n",
        );

        assert_eq!(status.branch, Some("trunk".to_owned()));
        assert_eq!(status.upstream, None);
        assert_eq!(status.untracked, 1);
        assert!(!status.clean);
    }
}
