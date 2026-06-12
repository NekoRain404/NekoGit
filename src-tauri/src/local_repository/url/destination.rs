//! Clone destination resolution for Local git repository operations / Repository URL handling.

use std::path::{Path, PathBuf};

use crate::local_repository::url::normalize_github_repository_clone_url;

/// Creates a deep copy.
pub(crate) fn clone_destination_path(
    repository_url: &str,
    destination_directory: &Path,
) -> Result<PathBuf, String> {
    let normalized = normalize_github_repository_clone_url(repository_url)
        .ok_or_else(|| "refusing to clone unsupported GitHub repository URL".to_owned())?;
    let repo_name = normalized
        .trim_end_matches(".git")
        .rsplit('/')
        .next()
        .ok_or_else(|| "failed to derive GitHub repository directory name".to_owned())?;

    Ok(destination_directory.join(repo_name))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_github_repository_clone_destination_paths() {
        assert_eq!(
            clone_destination_path(
                "https://github.com/owner/repo.git",
                Path::new("/tmp/nekogit-clones")
            )
            .unwrap(),
            PathBuf::from("/tmp/nekogit-clones/repo")
        );
    }
}
