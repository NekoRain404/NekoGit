use std::{
    path::Path,
    process::{Command, Output, Stdio},
};

use crate::local_repository::{
    parse::git_command_failure_details, storage::local_repository_status,
};

pub(crate) fn resolve_local_repository_path(
    app_data_dir: &Path,
    repository_url: &str,
) -> Result<(String, String), String> {
    let status = local_repository_status(app_data_dir, repository_url)?;
    let Some(repository_path) = status.path else {
        return Err("local repository is not available".to_owned());
    };

    Ok((status.repository_url, repository_path))
}

pub(crate) fn run_read_git_command(
    repository_path: &str,
    args: &[&str],
    start_error: &str,
    failure_prefix: &str,
) -> Result<Output, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repository_path)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("{start_error}: {error}"))?;

    if !output.status.success() {
        let details = git_command_failure_details(&output);
        return Err(format!("{failure_prefix}: {details}"));
    }

    Ok(output)
}
