//! Path status detection for Local git repository operations / Local storage management.

use std::path::{Path, PathBuf};

use crate::local_repository::{
    storage::{
        display::path_to_display_string,
        index::{read_local_repository_index, write_local_repository_index},
        paths::local_repositories_index_path,
        time::unix_timestamp_secs,
    },
    types::{DesktopLocalRepositoryEntry, DesktopLocalRepositoryStatus},
    url::normalize_github_repository_clone_url,
};

/// Remember local repository.
pub(crate) fn remember_local_repository(
    app_data_dir: &Path,
    repository_url: &str,
    repository_path: &Path,
) -> Result<DesktopLocalRepositoryEntry, String> {
    let repository_url = normalize_github_repository_clone_url(repository_url)
        .ok_or_else(|| "refusing to remember unsupported GitHub repository URL".to_owned())?;
    if !repository_path.is_dir() {
        return Err("local repository path must be an existing directory".to_owned());
    }

    let index_path = local_repositories_index_path(app_data_dir);
    let mut index = read_local_repository_index(&index_path);
    let entry = DesktopLocalRepositoryEntry {
        repository_url: repository_url.clone(),
        path: path_to_display_string(repository_path),
        updated_at: unix_timestamp_secs(),
    };

    index
        .repositories
        .retain(|item| item.repository_url != repository_url);
    index.repositories.insert(0, entry.clone());
    write_local_repository_index(&index_path, &index)?;

    Ok(entry)
}

/// Local repository status.
pub(crate) fn local_repository_status(
    app_data_dir: &Path,
    repository_url: &str,
) -> Result<DesktopLocalRepositoryStatus, String> {
    let repository_url = normalize_github_repository_clone_url(repository_url)
        .ok_or_else(|| "refusing to inspect unsupported GitHub repository URL".to_owned())?;
    let index_path = local_repositories_index_path(app_data_dir);
    let mut index = read_local_repository_index(&index_path);
    let entry = index
        .repositories
        .iter()
        .find(|entry| entry.repository_url == repository_url)
        .cloned();
    let Some(entry) = entry else {
        return Ok(DesktopLocalRepositoryStatus {
            repository_url,
            path: None,
            exists: false,
        });
    };

    let path = PathBuf::from(&entry.path);
    if path.is_dir() {
        return Ok(DesktopLocalRepositoryStatus {
            repository_url,
            path: Some(entry.path),
            exists: true,
        });
    }

    index
        .repositories
        .retain(|item| item.repository_url != repository_url);
    write_local_repository_index(&index_path, &index)?;

    Ok(DesktopLocalRepositoryStatus {
        repository_url,
        path: None,
        exists: false,
    })
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;
    use crate::local_repository::storage::{
        display::path_to_display_string, index::read_local_repository_index,
        paths::local_repositories_index_path, time::unix_timestamp_secs,
    };

    #[test]
    fn remembers_and_cleans_local_repository_status() {
        let base = std::env::temp_dir().join(format!(
            "nekogit-local-repo-test-{}-{}",
            std::process::id(),
            unix_timestamp_secs()
        ));
        let repo_path = base.join("repo");
        fs::create_dir_all(&repo_path).unwrap();

        let remembered =
            remember_local_repository(&base, "https://github.com/owner/repo.git", &repo_path)
                .unwrap();
        assert_eq!(
            remembered.repository_url,
            "https://github.com/owner/repo.git"
        );

        let status = local_repository_status(&base, "https://github.com/owner/repo.git").unwrap();
        assert!(status.exists);
        assert_eq!(status.path, Some(path_to_display_string(&repo_path)));

        fs::remove_dir_all(&repo_path).unwrap();
        let status = local_repository_status(&base, "https://github.com/owner/repo.git").unwrap();
        assert!(!status.exists);
        assert_eq!(status.path, None);

        let index = read_local_repository_index(&local_repositories_index_path(&base));
        assert!(index.repositories.is_empty());
        let _ = fs::remove_dir_all(&base);
    }
}
