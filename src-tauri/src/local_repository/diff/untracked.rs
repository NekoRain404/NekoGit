//! Untracked file diff handling for Local git repository operations / Diff computation.

use std::{
    fs,
    fs::File,
    io::Read,
    path::Path,
    process::{Command, Stdio},
};

/// Checks a condition.
pub(crate) fn is_untracked_repository_file(repository_path: &str, path: &str) -> bool {
    Command::new("git")
        .arg("-C")
        .arg(repository_path)
        .args(["ls-files", "--others", "--exclude-standard", "-z", "--"])
        .arg(path)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
        .output()
        .map(|output| output.status.success() && !output.stdout.is_empty())
        .unwrap_or(false)
}

/// Reads the data.
pub(crate) fn read_untracked_file_diff(
    local_path: &Path,
    relative_path: &str,
    max_bytes: usize,
) -> Result<(String, bool), String> {
    let metadata =
        fs::metadata(local_path).map_err(|error| format!("failed to inspect file: {error}"))?;
    if !metadata.is_file() {
        return Ok((String::new(), false));
    }

    let mut reader = File::open(local_path)
        .map_err(|error| format!("failed to open untracked file for diff: {error}"))?
        .take((max_bytes + 1) as u64);
    let mut bytes = Vec::new();
    reader
        .read_to_end(&mut bytes)
        .map_err(|error| format!("failed to read untracked file for diff: {error}"))?;

    let truncated = bytes.len() > max_bytes;
    if truncated {
        bytes.truncate(max_bytes);
        while !String::from_utf8_lossy(&bytes).is_char_boundary(bytes.len()) {
            bytes.pop();
        }
    }

    if bytes.contains(&0) {
        return Ok((
            format!("Binary file {relative_path} is untracked\n"),
            truncated,
        ));
    }

    let text = String::from_utf8_lossy(&bytes);
    let line_count = text.lines().count().max(1);
    let mut diff = format!(
        "diff --git a/{relative_path} b/{relative_path}\nnew file mode 100644\n--- /dev/null\n+++ b/{relative_path}\n@@ -0,0 +1,{line_count} @@\n"
    );
    if text.is_empty() {
        return Ok((diff, truncated));
    }

    for line in text.split_inclusive('\n') {
        diff.push('+');
        diff.push_str(line);
        if !line.ends_with('\n') {
            diff.push('\n');
        }
    }

    Ok((diff, truncated))
}
