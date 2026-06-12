//! Branch list parsing for Local git repository operations / Output parsing.

use crate::local_repository::types::{
    DesktopLocalRepositoryBranch, DesktopLocalRepositoryRemoteBranch,
};

use super::input::normalize_origin_remote_branch_name;

/// Parses the input.
pub(crate) fn parse_local_repository_branches_output(
    output: &str,
) -> Vec<DesktopLocalRepositoryBranch> {
    output
        .lines()
        .filter_map(|line| {
            let mut parts = line.splitn(3, '\0');
            let name = parts.next()?.trim();
            if name.is_empty() {
                return None;
            }

            let upstream = parts
                .next()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned);
            let current = parts.next().map(str::trim) == Some("*");

            Some(DesktopLocalRepositoryBranch {
                name: name.to_owned(),
                upstream,
                current,
            })
        })
        .collect()
}

/// Parses the input.
pub(crate) fn parse_local_repository_remote_branches_output(
    output: &str,
) -> Vec<DesktopLocalRepositoryRemoteBranch> {
    output
        .lines()
        .filter_map(|line| {
            let name = line.trim();
            let (name, local_name) = normalize_origin_remote_branch_name(name).ok()?;

            Some(DesktopLocalRepositoryRemoteBranch {
                name,
                local_name,
                checkoutable: true,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_local_repository_branches_output() {
        let branches = parse_local_repository_branches_output(
            "main\0origin/main\0*\nfeature/local\0origin/feature/local\0\nwip\0\0\n",
        );

        assert_eq!(branches.len(), 3);
        assert_eq!(branches[0].name, "main");
        assert_eq!(branches[0].upstream.as_deref(), Some("origin/main"));
        assert!(branches[0].current);
        assert_eq!(branches[1].name, "feature/local");
        assert_eq!(
            branches[1].upstream.as_deref(),
            Some("origin/feature/local")
        );
        assert!(!branches[1].current);
        assert_eq!(branches[2].name, "wip");
        assert_eq!(branches[2].upstream, None);
        assert!(!branches[2].current);
    }

    #[test]
    fn parses_local_repository_remote_branches_output() {
        let branches = parse_local_repository_remote_branches_output(
            "origin/HEAD\norigin/main\norigin/feature/remote\nupstream/ignored\norigin/bad branch\n",
        );

        assert_eq!(branches.len(), 2);
        assert_eq!(branches[0].name, "origin/main");
        assert_eq!(branches[0].local_name, "main");
        assert!(branches[0].checkoutable);
        assert_eq!(branches[1].name, "origin/feature/remote");
        assert_eq!(branches[1].local_name, "feature/remote");
    }
}
