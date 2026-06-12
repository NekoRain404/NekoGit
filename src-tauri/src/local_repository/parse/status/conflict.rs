//! Merge conflict parsing for Local git repository operations / Output parsing.

pub(super) fn is_unmerged_git_status_pair(status_pair: &str) -> bool {
    matches!(status_pair, "DD" | "AU" | "UD" | "UA" | "DU" | "AA" | "UU")
}
