use std::{
    io::Read,
    process::{Command, Stdio},
    thread,
    time::Duration,
};

const GITHUB_CLI_TOKEN_ATTEMPTS: usize = 50;
const GITHUB_CLI_TOKEN_INTERVAL: Duration = Duration::from_millis(100);

fn normalize_github_cli_token_output(value: &str) -> Option<String> {
    const GITHUB_TOKEN_PREFIXES: &[&str] = &["ghp_", "gho_", "ghu_", "ghs_", "ghr_", "github_pat_"];

    value
        .lines()
        .map(str::trim)
        .find(|line| {
            !line.is_empty()
                && !line.chars().any(char::is_control)
                && GITHUB_TOKEN_PREFIXES
                    .iter()
                    .any(|prefix| line.starts_with(prefix))
        })
        .map(str::to_owned)
}

/// Reads a GitHub personal access token from the `gh` CLI (`gh auth token`).
pub(crate) fn read_github_cli_token() -> Result<String, String> {
    let mut child = Command::new("gh")
        .args(["auth", "token"])
        .env("GH_NO_UPDATE_NOTIFIER", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                "GitHub CLI was not found. Install `gh` and run `gh auth login` first.".to_owned()
            } else {
                format!("failed to start GitHub CLI: {error}")
            }
        })?;

    for _ in 0..GITHUB_CLI_TOKEN_ATTEMPTS {
        match child.try_wait() {
            Ok(Some(status)) => {
                let mut stdout = String::new();
                if let Some(mut pipe) = child.stdout.take() {
                    pipe.read_to_string(&mut stdout)
                        .map_err(|error| format!("failed to read GitHub CLI token: {error}"))?;
                }

                let mut stderr = String::new();
                if let Some(mut pipe) = child.stderr.take() {
                    pipe.read_to_string(&mut stderr).map_err(|error| {
                        format!("failed to read GitHub CLI error output: {error}")
                    })?;
                }

                if !status.success() {
                    let detail = stderr.trim();
                    return Err(if detail.is_empty() {
                        "GitHub CLI has no active authenticated account. Run `gh auth login` first."
                            .to_owned()
                    } else {
                        format!("GitHub CLI could not provide a token: {detail}")
                    });
                }

                return normalize_github_cli_token_output(&stdout).ok_or_else(|| {
                    "GitHub CLI returned an empty token. Run `gh auth login` first.".to_owned()
                });
            }
            Ok(None) => thread::sleep(GITHUB_CLI_TOKEN_INTERVAL),
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("failed to wait for GitHub CLI: {error}"));
            }
        }
    }

    let _ = child.kill();
    let _ = child.wait();
    Err("timed out waiting for GitHub CLI. Run `gh auth token` in a terminal to inspect the account state.".to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_github_cli_token_output() {
        assert_eq!(
            normalize_github_cli_token_output("\n  github_pat_example_token  \n"),
            Some("github_pat_example_token".to_owned())
        );
        assert_eq!(
            normalize_github_cli_token_output("warning\nghp_actual_token\n"),
            Some("ghp_actual_token".to_owned())
        );
        assert_eq!(normalize_github_cli_token_output("\n\t\n"), None);
        assert_eq!(normalize_github_cli_token_output("bad\u{7}token\n"), None);
    }
}
