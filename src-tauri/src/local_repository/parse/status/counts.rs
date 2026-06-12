//! Change count aggregation for Local git repository operations / Output parsing.

use super::is_unmerged_git_status_pair;

#[derive(Default)]
pub(super) struct GitStatusCounts {
    pub(super) staged: u32,
    pub(super) unstaged: u32,
    pub(super) untracked: u32,
    pub(super) conflicted: u32,
}

impl GitStatusCounts {
    pub(super) fn include_porcelain_line(&mut self, line: &str) {
        if line.len() < 2 {
            return;
        }

        let status_pair = &line[..2];
        if status_pair == "??" {
            self.untracked += 1;
            return;
        }
        if status_pair == "!!" {
            return;
        }
        if is_unmerged_git_status_pair(status_pair) {
            self.conflicted += 1;
            return;
        }

        let mut chars = status_pair.chars();
        let index_status = chars.next().unwrap_or(' ');
        let worktree_status = chars.next().unwrap_or(' ');

        if !matches!(index_status, ' ' | '?' | '!') {
            self.staged += 1;
        }
        if !matches!(worktree_status, ' ' | '?' | '!') {
            self.unstaged += 1;
        }
    }

    pub(super) fn is_clean(&self) -> bool {
        self.staged == 0 && self.unstaged == 0 && self.untracked == 0 && self.conflicted == 0
    }
}
