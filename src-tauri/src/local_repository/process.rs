//! Timeout-guarded child process execution for local Git network operations.
//!
//! Network Git commands (clone/fetch/pull/push) can hang indefinitely on a
//! stalled connection or credential prompt. This module runs a [`Command`] with
//! a bounded timeout while draining stdout/stderr on dedicated reader threads so
//! that large output cannot deadlock the child.

use std::{
    io::Read,
    process::{Command, ExitStatus, Output, Stdio},
    thread,
    time::{Duration, Instant},
};

/// Default timeout for local Git network operations.
pub(crate) const DEFAULT_GIT_TIMEOUT_SECS: u64 = 120;
/// Upper bound accepted from `NEKOGIT_GIT_TIMEOUT_SECS`.
pub(crate) const MAX_GIT_TIMEOUT_SECS: u64 = 3600;
const GIT_TIMEOUT_ENV: &str = "NEKOGIT_GIT_TIMEOUT_SECS";
const OUTPUT_POLL_INTERVAL: Duration = Duration::from_millis(25);

/// Failure while running a timeout-guarded command.
#[derive(Debug)]
pub(crate) enum CommandRunError {
    /// The command could not be spawned.
    Spawn { message: String },
    /// The command exceeded its timeout and was killed.
    Timeout {
        description: String,
        timeout: Duration,
    },
    /// Waiting for or reading from the child failed.
    Io { message: String },
}

impl CommandRunError {
    /// A distinct, actionable message suitable for returning to the UI.
    pub(crate) fn message(&self) -> String {
        match self {
            Self::Spawn { message } | Self::Io { message } => message.clone(),
            Self::Timeout {
                description,
                timeout,
            } => format!(
                "{description} timed out after {}s",
                format_timeout_seconds(*timeout)
            ),
        }
    }
}

impl std::fmt::Display for CommandRunError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.message())
    }
}

impl std::error::Error for CommandRunError {}

impl From<CommandRunError> for String {
    fn from(error: CommandRunError) -> Self {
        error.message()
    }
}

fn format_timeout_seconds(timeout: Duration) -> String {
    let seconds = timeout.as_secs_f64();
    if seconds.fract() == 0.0 {
        timeout.as_secs().to_string()
    } else {
        seconds.to_string()
    }
}

/// Resolves the timeout for Git network operations from the environment.
///
/// `NEKOGIT_GIT_TIMEOUT_SECS` accepts a positive integer number of seconds and
/// is clamped to [`MAX_GIT_TIMEOUT_SECS`]. Missing, empty, zero, or otherwise
/// invalid values fall back to [`DEFAULT_GIT_TIMEOUT_SECS`].
pub(crate) fn git_network_timeout() -> Duration {
    let raw = std::env::var(GIT_TIMEOUT_ENV).ok();
    Duration::from_secs(parse_git_timeout_secs(raw.as_deref()))
}

/// Parses a raw `NEKOGIT_GIT_TIMEOUT_SECS` value into a clamped number of seconds.
pub(crate) fn parse_git_timeout_secs(raw: Option<&str>) -> u64 {
    raw.and_then(|raw| raw.trim().parse::<u64>().ok())
        .filter(|seconds| *seconds > 0)
        .map_or(DEFAULT_GIT_TIMEOUT_SECS, |seconds| {
            seconds.min(MAX_GIT_TIMEOUT_SECS)
        })
}

fn spawn_reader<R>(mut reader: R) -> thread::JoinHandle<Vec<u8>>
where
    R: Read + Send + 'static,
{
    thread::spawn(move || {
        let mut buffer = Vec::new();
        let _ = reader.read_to_end(&mut buffer);
        buffer
    })
}

fn join_reader(
    handle: thread::JoinHandle<Vec<u8>>,
    description: &str,
    stream: &str,
) -> Result<Vec<u8>, CommandRunError> {
    handle.join().map_err(|_| CommandRunError::Io {
        message: format!("failed to read {description} {stream}"),
    })
}

/// Runs `command` with captured output, killing it once `timeout` elapses.
///
/// stdout and stderr are drained concurrently on reader threads, so a chatty
/// child cannot block on a full pipe. On timeout the child is killed and reaped
/// before a [`CommandRunError::Timeout`] is returned; the message names both the
/// command description and the timeout. On a normal exit the returned
/// [`Output`] holds the real exit status and captured streams, including for
/// non-zero exits.
pub(crate) fn run_command_with_timeout(
    command: &mut Command,
    description: &str,
    timeout: Duration,
) -> Result<Output, CommandRunError> {
    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command.spawn().map_err(|error| CommandRunError::Spawn {
        message: format!("failed to start {description}: {error}"),
    })?;

    let (Some(stdout), Some(stderr)) = (child.stdout.take(), child.stderr.take()) else {
        let _ = child.kill();
        let _ = child.wait();
        return Err(CommandRunError::Io {
            message: format!("failed to capture {description} output"),
        });
    };

    let stdout_reader = spawn_reader(stdout);
    let stderr_reader = spawn_reader(stderr);
    let deadline = Instant::now() + timeout;

    let status: ExitStatus = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    // Reader threads are deliberately detached: a killed child may
                    // leave grandchildren holding the pipe open, and joining here
                    // would reintroduce the hang the timeout exists to prevent.
                    drop(stdout_reader);
                    drop(stderr_reader);
                    return Err(CommandRunError::Timeout {
                        description: description.to_owned(),
                        timeout,
                    });
                }
                thread::sleep(OUTPUT_POLL_INTERVAL);
            }
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                drop(stdout_reader);
                drop(stderr_reader);
                return Err(CommandRunError::Io {
                    message: format!("failed to wait for {description}: {error}"),
                });
            }
        }
    };

    let stdout = join_reader(stdout_reader, description, "stdout")?;
    let stderr = join_reader(stderr_reader, description, "stderr")?;

    Ok(Output {
        status,
        stdout,
        stderr,
    })
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn captures_output_from_fast_command() {
        let mut command = Command::new("sh");
        command.args(["-c", "printf 'hello'; printf 'oops' >&2"]);

        let output = run_command_with_timeout(&mut command, "sh printf", Duration::from_secs(5))
            .expect("fast command succeeds");

        assert!(output.status.success());
        assert_eq!(output.stdout, b"hello");
        assert_eq!(output.stderr, b"oops");
    }

    #[test]
    fn times_out_slow_command() {
        let mut command = Command::new("sh");
        command.args(["-c", "sleep 5"]);
        let started = Instant::now();

        let error = run_command_with_timeout(&mut command, "sh sleep", Duration::from_millis(80))
            .expect_err("slow command times out");

        assert!(matches!(
            error,
            CommandRunError::Timeout {
                ref description,
                ..
            } if description == "sh sleep"
        ));
        assert!(
            error.message().contains("timed out after"),
            "message should describe the timeout: {}",
            error.message()
        );
        assert!(
            started.elapsed() < Duration::from_secs(2),
            "timeout should return promptly"
        );
    }

    #[test]
    fn parses_timeout_environment_override() {
        assert_eq!(parse_git_timeout_secs(Some("7")), 7);
        assert_eq!(parse_git_timeout_secs(Some(" 3600 ")), MAX_GIT_TIMEOUT_SECS);
        assert_eq!(parse_git_timeout_secs(Some("9999")), MAX_GIT_TIMEOUT_SECS);

        assert_eq!(parse_git_timeout_secs(None), DEFAULT_GIT_TIMEOUT_SECS);
        assert_eq!(parse_git_timeout_secs(Some("")), DEFAULT_GIT_TIMEOUT_SECS);
        assert_eq!(parse_git_timeout_secs(Some("0")), DEFAULT_GIT_TIMEOUT_SECS);
        assert_eq!(parse_git_timeout_secs(Some("-5")), DEFAULT_GIT_TIMEOUT_SECS);
        assert_eq!(
            parse_git_timeout_secs(Some("not-a-number")),
            DEFAULT_GIT_TIMEOUT_SECS
        );
    }
}
