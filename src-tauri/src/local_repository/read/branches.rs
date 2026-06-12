use std::path::Path;

use super::git::{resolve_local_repository_path, run_read_git_command};
use crate::local_repository::{
    parse::{
        parse_local_repository_branches_output, parse_local_repository_remote_branches_output,
    },
    types::DesktopLocalRepositoryBranches,
};

pub(crate) fn local_repository_branches(
    app_data_dir: &Path,
    repository_url: &str,
) -> Result<DesktopLocalRepositoryBranches, String> {
    let (repository_url, repository_path) =
        resolve_local_repository_path(app_data_dir, repository_url)?;
    let output = run_read_git_command(
        &repository_path,
        &[
            "branch",
            "--format=%(refname:short)%00%(upstream:short)%00%(HEAD)",
        ],
        "failed to start git branch",
        "git branch failed",
    )?;

    let branches = parse_local_repository_branches_output(&String::from_utf8_lossy(&output.stdout));
    let current_branch = branches
        .iter()
        .find(|branch| branch.current)
        .map(|branch| branch.name.clone());
    let output = run_read_git_command(
        &repository_path,
        &[
            "for-each-ref",
            "--format=%(refname:short)",
            "refs/remotes/origin",
        ],
        "failed to start git for-each-ref",
        "git for-each-ref failed",
    )?;

    let mut remote_branches =
        parse_local_repository_remote_branches_output(&String::from_utf8_lossy(&output.stdout));
    for remote_branch in &mut remote_branches {
        remote_branch.checkoutable = !branches.iter().any(|branch| {
            branch.upstream.as_deref() == Some(remote_branch.name.as_str())
                || branch.name == remote_branch.local_name
        });
    }

    Ok(DesktopLocalRepositoryBranches {
        repository_url,
        repository_path,
        current_branch,
        branches,
        remote_branches,
    })
}
