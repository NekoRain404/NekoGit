//! Path status detection for Local git repository operations / Path resolution.

use std::path::{Path, PathBuf};

use super::resolve::ensure_repository_path_within_root;
use crate::local_repository::{
    paths::normalize::{normalize_repository_relative_path, repository_relative_path_string},
    storage::{local_repository_status, path_to_display_string},
    types::DesktopLocalRepositoryPathStatus,
};

/// Local repository path status.
pub(crate) fn local_repository_path_status(
    app_data_dir: &Path,
    repository_url: &str,
    relative_path: &str,
) -> Result<DesktopLocalRepositoryPathStatus, String> {
    let status = local_repository_status(app_data_dir, repository_url)?;
    let normalized_relative_path = normalize_repository_relative_path(relative_path)?;
    let relative_path = repository_relative_path_string(&normalized_relative_path);
    let Some(repository_path) = status.path.as_deref() else {
        return Ok(DesktopLocalRepositoryPathStatus {
            repository_url: status.repository_url,
            repository_path: None,
            relative_path,
            path: None,
            exists: false,
            is_directory: false,
        });
    };

    let repository_root = PathBuf::from(repository_path);
    let local_path = repository_root.join(&normalized_relative_path);
    if !local_path.starts_with(&repository_root) {
        return Err("repository path must stay inside the local repository".to_owned());
    }

    ensure_repository_path_within_root(&repository_root, &local_path)?;

    let exists = local_path.exists();
    let is_directory = exists && local_path.is_dir();

    Ok(DesktopLocalRepositoryPathStatus {
        repository_url: status.repository_url,
        repository_path: Some(repository_path.to_owned()),
        relative_path,
        path: exists.then(|| path_to_display_string(&local_path)),
        exists,
        is_directory,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::local_repository::storage::{
        path_to_display_string, remember_local_repository, unix_timestamp_secs,
    };

    #[test]
    fn resolves_local_repository_relative_paths_safely() {
        let base = std::env::temp_dir().join(format!(
            "nekogit-local-repo-path-test-{}-{}",
            std::process::id(),
            unix_timestamp_secs()
        ));
        let repo_path = base.join("repo");
        let file_path = repo_path.join("src").join("lib.rs");
        std::fs::create_dir_all(file_path.parent().unwrap()).unwrap();
        std::fs::write(&file_path, "fn main() {}\n").unwrap();
        remember_local_repository(&base, "https://github.com/owner/repo.git", &repo_path).unwrap();

        let status =
            local_repository_path_status(&base, "https://github.com/owner/repo.git", "src/lib.rs")
                .unwrap();
        assert_eq!(status.repository_url, "https://github.com/owner/repo.git");
        assert_eq!(
            status.repository_path,
            Some(path_to_display_string(&repo_path))
        );
        assert_eq!(status.relative_path, "src/lib.rs");
        assert_eq!(status.path, Some(path_to_display_string(&file_path)));
        assert!(status.exists);
        assert!(!status.is_directory);

        let status =
            local_repository_path_status(&base, "https://github.com/owner/repo.git", "src")
                .unwrap();
        assert!(status.exists);
        assert!(status.is_directory);

        assert!(local_repository_path_status(
            &base,
            "https://github.com/owner/repo.git",
            "../secret"
        )
        .is_err());
        assert!(local_repository_path_status(
            &base,
            "https://github.com/owner/repo.git",
            "/tmp/file"
        )
        .is_err());

        let _ = std::fs::remove_dir_all(&base);
    }
}
