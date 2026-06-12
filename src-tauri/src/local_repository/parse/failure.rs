//! Parse error types for Local git repository operations / Output parsing.

use std::process::Output;

/// Git command failure details.
pub(crate) fn git_command_failure_details(output: &Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_owned();

    if !stderr.is_empty() {
        stderr
    } else if !stdout.is_empty() {
        stdout
    } else {
        output.status.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    fn failing_exit_status() -> std::process::ExitStatus {
        use std::os::unix::process::ExitStatusExt;
        std::process::ExitStatus::from_raw(1 << 8)
    }

    #[cfg(windows)]
    fn failing_exit_status() -> std::process::ExitStatus {
        use std::os::windows::process::ExitStatusExt;
        std::process::ExitStatus::from_raw(1)
    }

    #[test]
    fn prefers_git_command_stderr_when_formatting_failures() {
        let output = std::process::Output {
            status: failing_exit_status(),
            stdout: b"stdout details\n".to_vec(),
            stderr: b"stderr details\n".to_vec(),
        };

        assert_eq!(git_command_failure_details(&output), "stderr details");
    }
}
