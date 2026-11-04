//! Path status detection for Local git repository operations / Local storage management.

use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

use crate::local_repository::{
    storage::{
        display::path_to_display_string,
        index::{read_local_repository_index, write_local_repository_index},
        paths::local_repositories_index_path,
        time::unix_timestamp_secs,
    },
    types::{DesktopLocalRepositoryEntry, DesktopLocalRepositoryStatus},
    url::{normalize_github_remote_url, normalize_github_repository_clone_url},
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

fn run_git_in_directory(
    repository_path: &Path,
    args: &[&str],
    label: &str,
) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repository_path)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("failed to start {label}: {error}"))?;

    if !output.status.success() {
        let details = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(if details.is_empty() {
            format!("{label} failed")
        } else {
            format!("{label} failed: {details}")
        });
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_owned())
}

/// Adopt an existing local Git clone after verifying its `origin` points at the
/// requested GitHub repository. Returns the remembered status on success.
pub(crate) fn remember_existing_local_repository(
    app_data_dir: &Path,
    repository_url: &str,
    repository_path: &Path,
) -> Result<DesktopLocalRepositoryStatus, String> {
    let repository_url = normalize_github_repository_clone_url(repository_url)
        .ok_or_else(|| "refusing to adopt an unsupported GitHub repository URL".to_owned())?;

    let selected_path = fs::canonicalize(repository_path)
        .map_err(|error| format!("failed to resolve local repository path: {error}"))?;
    if !selected_path.is_dir() {
        return Err("local repository path must be an existing directory".to_owned());
    }

    let top_level = run_git_in_directory(
        &selected_path,
        &["rev-parse", "--show-toplevel"],
        "git rev-parse",
    )?;
    let canonical_root = fs::canonicalize(top_level.trim())
        .map_err(|error| format!("failed to resolve Git repository root: {error}"))?;

    if !selected_path.starts_with(&canonical_root) {
        return Err("selected path is not inside the Git repository root".to_owned());
    }

    let origin = run_git_in_directory(
        &canonical_root,
        &["remote", "get-url", "origin"],
        "git remote get-url origin",
    )?;
    let origin_url = normalize_github_remote_url(&origin)
        .ok_or_else(|| "the repository origin remote is not a supported GitHub URL".to_owned())?;

    if origin_url != repository_url {
        return Err(format!(
            "local repository origin `{origin_url}` does not match `{repository_url}`"
        ));
    }

    remember_local_repository(app_data_dir, &repository_url, &canonical_root)?;
    local_repository_status(app_data_dir, &repository_url)
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
    #[test]
    fn adopts_an_existing_git_clone_with_matching_origin() {
        let base = std::env::temp_dir().join(format!(
            "nekogit-adopt-local-repo-test-{}-{}",
            std::process::id(),
            unix_timestamp_secs()
        ));
        let repo_path = base.join("repo");
        fs::create_dir_all(&repo_path).unwrap();

        let git = |args: &[&str]| {
            let output = std::process::Command::new("git")
                .arg("-C")
                .arg(&repo_path)
                .args(args)
                .output()
                .unwrap();
            assert!(output.status.success(), "git {:?} failed", args);
        };
        git(&["init", "-q"]);
        git(&["remote", "add", "origin", "git@github.com:owner/repo.git"]);

        let status = remember_existing_local_repository(
            &base,
            "https://github.com/owner/repo.git",
            &repo_path,
        )
        .unwrap();

        assert!(status.exists);
        assert_eq!(status.path, Some(path_to_display_string(&repo_path)));

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn rejects_an_existing_clone_with_a_mismatched_origin() {
        let base = std::env::temp_dir().join(format!(
            "nekogit-adopt-local-repo-mismatch-{}-{}",
            std::process::id(),
            unix_timestamp_secs()
        ));
        let repo_path = base.join("repo");
        fs::create_dir_all(&repo_path).unwrap();

        let output = std::process::Command::new("git")
            .arg("-C")
            .arg(&repo_path)
            .args(["init", "-q"])
            .output()
            .unwrap();
        assert!(output.status.success());
        let output = std::process::Command::new("git")
            .arg("-C")
            .arg(&repo_path)
            .args([
                "remote",
                "add",
                "origin",
                "https://github.com/owner/other.git",
            ])
            .output()
            .unwrap();
        assert!(output.status.success());

        let result = remember_existing_local_repository(
            &base,
            "https://github.com/owner/repo.git",
            &repo_path,
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not match"));

        let _ = fs::remove_dir_all(&base);
    }
}
