use std::process::{Command, Stdio};

pub(super) fn git_command(repository_path: &str) -> Command {
    let mut command = Command::new("git");
    command
        .arg("-C")
        .arg(repository_path)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null());
    command
}

fn git_ref_exists(repository_path: &str, refname: &str) -> Result<bool, String> {
    let output = git_command(repository_path)
        .args(["rev-parse", "--verify", "--quiet"])
        .arg(refname)
        .output()
        .map_err(|error| format!("failed to start git rev-parse: {error}"))?;

    Ok(output.status.success())
}

pub(super) fn branch_name_exists(repository_path: &str, branch_name: &str) -> Result<bool, String> {
    git_ref_exists(repository_path, &format!("refs/heads/{branch_name}"))
}

pub(super) fn remote_branch_exists(
    repository_path: &str,
    remote_branch_name: &str,
) -> Result<bool, String> {
    git_ref_exists(
        repository_path,
        &format!("refs/remotes/{remote_branch_name}"),
    )
}
