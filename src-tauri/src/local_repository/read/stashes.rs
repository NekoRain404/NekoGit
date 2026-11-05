//! Stash list reading for Local git repository operations / Read-only git queries.

use std::path::Path;

use super::git::{resolve_local_repository_path, run_read_git_command};
use crate::local_repository::types::{DesktopLocalRepositoryStash, DesktopLocalRepositoryStashes};

/// `git stash list` format: fields are NUL separated and entries are newline
/// separated. Reflog subjects are single-line entries, so the message can never
/// introduce an ambiguous record boundary.
const STASH_LIST_FORMAT: &str = "--format=%gd%x00%H%x00%gs%x00%ct%x00%ci";

/// Local repository stashes.
pub(crate) fn local_repository_stashes(
    app_data_dir: &Path,
    repository_url: &str,
) -> Result<DesktopLocalRepositoryStashes, String> {
    let (repository_url, repository_path) =
        resolve_local_repository_path(app_data_dir, repository_url)?;
    let output = run_read_git_command(
        &repository_path,
        &["stash", "list", STASH_LIST_FORMAT],
        "failed to start git stash list",
        "git stash list failed",
    )?;

    Ok(DesktopLocalRepositoryStashes {
        repository_url,
        repository_path,
        stashes: parse_local_repository_stashes_output(&String::from_utf8_lossy(&output.stdout)),
    })
}

/// Parses `git stash list` output produced by [`STASH_LIST_FORMAT`].
pub(crate) fn parse_local_repository_stashes_output(
    output: &str,
) -> Vec<DesktopLocalRepositoryStash> {
    output
        .lines()
        .filter_map(parse_local_repository_stash_line)
        .collect()
}

fn parse_local_repository_stash_line(line: &str) -> Option<DesktopLocalRepositoryStash> {
    let line = line.trim_end_matches('\r');
    if line.trim().is_empty() {
        return None;
    }

    let mut fields = line.splitn(5, '\x00');
    let reference = fields.next()?.trim();
    let sha = fields.next()?.trim();
    let message = fields.next()?.trim();
    let committed_at = fields.next()?.trim().parse().ok()?;
    let date = fields.next()?.trim();
    let index = parse_local_repository_stash_index(reference)?;
    if sha.is_empty() {
        return None;
    }

    Some(DesktopLocalRepositoryStash {
        index,
        reference: reference.to_owned(),
        sha: sha.to_owned(),
        message: message.to_owned(),
        date: date.to_owned(),
        committed_at,
    })
}

fn parse_local_repository_stash_index(reference: &str) -> Option<u32> {
    reference
        .strip_prefix("stash@{")?
        .strip_suffix('}')?
        .parse()
        .ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_stash_list_output() {
        let stashes = parse_local_repository_stashes_output(
            "stash@{0}\x00abc123\x00NekoGit: stash main\x001700000000\x002026-11-04 20:00:00 +0800\n\
             stash@{12}\x00def456\x00On main: WIP \u{1f} with unit separator\x001700000001\x002026-11-03 09:30:00 +0800\n",
        );

        assert_eq!(stashes.len(), 2);
        assert_eq!(stashes[0].index, 0);
        assert_eq!(stashes[0].reference, "stash@{0}");
        assert_eq!(stashes[0].sha, "abc123");
        assert_eq!(stashes[0].message, "NekoGit: stash main");
        assert_eq!(stashes[0].date, "2026-11-04 20:00:00 +0800");
        assert_eq!(stashes[0].committed_at, 1_700_000_000);

        assert_eq!(stashes[1].index, 12);
        assert_eq!(stashes[1].reference, "stash@{12}");
        assert_eq!(stashes[1].sha, "def456");
        assert_eq!(
            stashes[1].message,
            "On main: WIP \u{1f} with unit separator"
        );
        assert_eq!(stashes[1].committed_at, 1_700_000_001);
    }

    #[test]
    fn parses_empty_stash_list_output() {
        assert!(parse_local_repository_stashes_output("").is_empty());
        assert!(parse_local_repository_stashes_output("\n\r\n").is_empty());
    }

    #[test]
    fn skips_malformed_stash_entries_safely() {
        let stashes = parse_local_repository_stashes_output(
            "stash@{0}\x00abc123\x00valid\x001700000000\x002026-11-04 20:00:00 +0800\n\
             not-a-stash-ref\x00abc123\x00bad ref\x001700000000\x002026-11-04 20:00:00 +0800\n\
             stash@{1}\x00\x00missing sha\x001700000000\x002026-11-04 20:00:00 +0800\n\
             stash@{2}\x00def456\x00missing fields\x001700000000\n",
        );

        assert_eq!(stashes.len(), 1);
        assert_eq!(stashes[0].reference, "stash@{0}");
    }
}
