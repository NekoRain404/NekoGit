use std::process::{Command, Stdio};

use crate::local_repository::parse::git_command_failure_details;

pub(crate) fn run_git_diff(
    repository_path: &str,
    args: &[&str],
    pathspecs: &[String],
) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repository_path)
        .args(args)
        .arg("--")
        .args(pathspecs)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("failed to start git diff: {error}"))?;

    if !output.status.success() {
        let details = git_command_failure_details(&output);
        return Err(format!("git diff failed: {details}"));
    }

    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}
