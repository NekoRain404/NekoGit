//! Type definitions for Local git repository operations.

use serde::{Deserialize, Serialize};

pub(crate) const LOCAL_REPOSITORIES_FILE: &str = "local-repositories.json";
pub(crate) const MAX_LOCAL_REPOSITORY_COMMIT_MESSAGE_CHARS: usize = 10_000;
pub(crate) const MAX_LOCAL_REPOSITORY_DIFF_BYTES: u32 = 250_000;
pub(crate) const MIN_LOCAL_REPOSITORY_DIFF_BYTES: u32 = 4_096;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopCloneRepositoryResult {
    pub(crate) repository_url: String,
    pub(crate) destination_path: String,
    pub(crate) opened_destination: bool,
    pub(crate) open_destination_error: Option<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopLocalRepositoryEntry {
    pub(crate) repository_url: String,
    pub(crate) path: String,
    pub(crate) updated_at: u64,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopLocalRepositoryStatus {
    pub(crate) repository_url: String,
    pub(crate) path: Option<String>,
    pub(crate) exists: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopLocalRepositoryPathStatus {
    pub(crate) repository_url: String,
    pub(crate) repository_path: Option<String>,
    pub(crate) relative_path: String,
    pub(crate) path: Option<String>,
    pub(crate) exists: bool,
    pub(crate) is_directory: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopLocalRepositoryGitStatus {
    pub(crate) repository_url: String,
    pub(crate) repository_path: String,
    pub(crate) branch: Option<String>,
    pub(crate) upstream: Option<String>,
    pub(crate) last_commit: Option<DesktopLocalRepositoryGitCommit>,
    pub(crate) ahead: u32,
    pub(crate) behind: u32,
    pub(crate) staged: u32,
    pub(crate) unstaged: u32,
    pub(crate) untracked: u32,
    pub(crate) conflicted: u32,
    pub(crate) clean: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopLocalRepositoryBranches {
    pub(crate) repository_url: String,
    pub(crate) repository_path: String,
    pub(crate) current_branch: Option<String>,
    pub(crate) branches: Vec<DesktopLocalRepositoryBranch>,
    pub(crate) remote_branches: Vec<DesktopLocalRepositoryRemoteBranch>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopLocalRepositoryBranch {
    pub(crate) name: String,
    pub(crate) upstream: Option<String>,
    pub(crate) current: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopLocalRepositoryRemoteBranch {
    pub(crate) name: String,
    pub(crate) local_name: String,
    pub(crate) checkoutable: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopLocalRepositoryChangedFiles {
    pub(crate) repository_url: String,
    pub(crate) repository_path: String,
    pub(crate) files: Vec<DesktopLocalRepositoryChangedFile>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopLocalRepositoryChangedFile {
    pub(crate) path: String,
    pub(crate) previous_path: Option<String>,
    pub(crate) status: String,
    pub(crate) status_kind: String,
    pub(crate) staged: bool,
    pub(crate) unstaged: bool,
    pub(crate) untracked: bool,
    pub(crate) conflicted: bool,
    pub(crate) openable: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopLocalRepositoryFileDiff {
    pub(crate) repository_url: String,
    pub(crate) repository_path: String,
    pub(crate) path: String,
    pub(crate) previous_path: Option<String>,
    pub(crate) staged_diff: String,
    pub(crate) unstaged_diff: String,
    pub(crate) untracked_diff: String,
    pub(crate) truncated: bool,
    pub(crate) empty: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopLocalRepositoryGitCommit {
    pub(crate) oid: String,
    pub(crate) short_oid: String,
    pub(crate) author_name: String,
    pub(crate) author_email: String,
    pub(crate) authored_at: u64,
    pub(crate) summary: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopLocalRepositoryCommitHistory {
    pub(crate) repository_url: String,
    pub(crate) repository_path: String,
    pub(crate) commits: Vec<DesktopLocalRepositoryGitCommit>,
}

#[derive(Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopLocalRepositoryIndex {
    pub(crate) repositories: Vec<DesktopLocalRepositoryEntry>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_desktop_clone_repository_result_for_frontend() {
        let result = DesktopCloneRepositoryResult {
            repository_url: "https://github.com/owner/repo.git".to_owned(),
            destination_path: "/tmp/repo".to_owned(),
            opened_destination: false,
            open_destination_error: Some("xdg-open unavailable".to_owned()),
        };

        assert_eq!(
            serde_json::to_string(&result).unwrap(),
            r#"{"repositoryUrl":"https://github.com/owner/repo.git","destinationPath":"/tmp/repo","openedDestination":false,"openDestinationError":"xdg-open unavailable"}"#
        );
    }
}
