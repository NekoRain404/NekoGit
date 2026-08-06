//! Parses desktop startup command-line arguments (e.g. `--start-hidden`).

use std::env;

use crate::desktop_autostart::START_HIDDEN_ARG;

fn start_hidden_from_args<I, S>(args: I) -> bool
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    args.into_iter().any(|arg| arg.as_ref() == START_HIDDEN_ARG)
}

/// Returns `true` when the application was launched with `--start-hidden`.
pub(crate) fn current_start_hidden() -> bool {
    start_hidden_from_args(env::args().skip(1))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_start_hidden_launch_arg() {
        assert!(start_hidden_from_args(["--ignored", START_HIDDEN_ARG]));
        assert!(!start_hidden_from_args([
            "nekogit://open?url=https://github.com/owner/repo"
        ]));
    }
}
