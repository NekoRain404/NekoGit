use crate::local_repository::types::DesktopLocalRepositoryChangedFile;

use super::status::is_unmerged_git_status_pair;

fn decode_git_porcelain_path(value: &[u8]) -> String {
    String::from_utf8_lossy(value).into_owned()
}

fn classify_changed_file_status(
    index_status: char,
    worktree_status: char,
    untracked: bool,
    conflicted: bool,
) -> String {
    if conflicted {
        "conflict".to_owned()
    } else if untracked {
        "untracked".to_owned()
    } else if index_status == 'D' || worktree_status == 'D' {
        "deleted".to_owned()
    } else if index_status == 'R' {
        "renamed".to_owned()
    } else if index_status == 'C' {
        "copied".to_owned()
    } else if index_status == 'A' || worktree_status == 'A' {
        "added".to_owned()
    } else {
        "modified".to_owned()
    }
}

pub(crate) fn parse_local_repository_changed_files_output(
    output: &[u8],
    limit: usize,
) -> Vec<DesktopLocalRepositoryChangedFile> {
    let limit = limit.max(1);
    let mut files = Vec::new();
    let mut records = output
        .split(|value| *value == 0)
        .filter(|record| !record.is_empty());

    while files.len() < limit {
        let Some(record) = records.next() else {
            break;
        };
        if record.len() < 4 || record[2] != b' ' {
            continue;
        }

        let index_status = record[0] as char;
        let worktree_status = record[1] as char;
        let status = format!("{index_status}{worktree_status}");

        if status == "!!" {
            continue;
        }

        let path = decode_git_porcelain_path(&record[3..]);
        if path.is_empty() {
            continue;
        }

        let previous_path = if matches!(index_status, 'R' | 'C') {
            records.next().map(decode_git_porcelain_path)
        } else {
            None
        };
        let untracked = status == "??";
        let conflicted = is_unmerged_git_status_pair(&status);
        let staged = !untracked && !conflicted && !matches!(index_status, ' ' | '?' | '!');
        let unstaged = !untracked && !conflicted && !matches!(worktree_status, ' ' | '?' | '!');
        let deleted = !untracked && (index_status == 'D' || worktree_status == 'D');
        let status_kind =
            classify_changed_file_status(index_status, worktree_status, untracked, conflicted);

        files.push(DesktopLocalRepositoryChangedFile {
            path,
            previous_path,
            status,
            status_kind,
            staged,
            unstaged,
            untracked,
            conflicted,
            openable: !deleted,
        });
    }

    files
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_local_repository_changed_files_output() {
        let files = parse_local_repository_changed_files_output(
            concat!(
                " M src/lib.rs\0",
                "M  Cargo.toml\0",
                "MM README.md\0",
                "?? new file.txt\0",
                "R  new-name.rs\0old-name.rs\0",
                " D deleted.rs\0",
                "UU conflict.txt\0",
                "!! ignored.log\0",
            )
            .as_bytes(),
            100,
        );

        assert_eq!(files.len(), 7);
        assert_eq!(files[0].path, "src/lib.rs");
        assert_eq!(files[0].status, " M");
        assert_eq!(files[0].status_kind, "modified");
        assert!(!files[0].staged);
        assert!(files[0].unstaged);
        assert!(files[0].openable);

        assert_eq!(files[1].path, "Cargo.toml");
        assert!(files[1].staged);
        assert!(!files[1].unstaged);

        assert_eq!(files[3].path, "new file.txt");
        assert!(files[3].untracked);
        assert_eq!(files[3].status_kind, "untracked");

        assert_eq!(files[4].path, "new-name.rs");
        assert_eq!(files[4].previous_path.as_deref(), Some("old-name.rs"));
        assert_eq!(files[4].status_kind, "renamed");

        assert_eq!(files[5].path, "deleted.rs");
        assert_eq!(files[5].status_kind, "deleted");
        assert!(!files[5].openable);

        assert_eq!(files[6].path, "conflict.txt");
        assert!(files[6].conflicted);
        assert_eq!(files[6].status_kind, "conflict");
    }

    #[test]
    fn limits_local_repository_changed_files_output() {
        let files = parse_local_repository_changed_files_output(
            concat!(" M one.rs\0", " M two.rs\0", " M three.rs\0").as_bytes(),
            2,
        );

        assert_eq!(files.len(), 2);
        assert_eq!(files[0].path, "one.rs");
        assert_eq!(files[1].path, "two.rs");
    }
}
