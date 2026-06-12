//! Repository index management for Local git repository operations / Local storage management.

use std::{collections::HashSet, fs, path::Path};

use crate::local_repository::{
    types::{DesktopLocalRepositoryEntry, DesktopLocalRepositoryIndex},
    url::normalize_github_repository_clone_url,
};

fn normalize_local_repository_entry(
    entry: &DesktopLocalRepositoryEntry,
) -> Option<DesktopLocalRepositoryEntry> {
    let repository_url = normalize_github_repository_clone_url(&entry.repository_url)?;
    let path = entry.path.trim();
    if path.is_empty() || path.chars().any(char::is_control) {
        return None;
    }

    Some(DesktopLocalRepositoryEntry {
        repository_url,
        path: path.to_owned(),
        updated_at: entry.updated_at,
    })
}

fn normalize_local_repository_index(
    index: DesktopLocalRepositoryIndex,
) -> DesktopLocalRepositoryIndex {
    let mut repositories = Vec::new();
    let mut seen = HashSet::new();

    for entry in index.repositories {
        let Some(entry) = normalize_local_repository_entry(&entry) else {
            continue;
        };
        if !seen.insert(entry.repository_url.clone()) {
            continue;
        }
        repositories.push(entry);
    }

    DesktopLocalRepositoryIndex { repositories }
}

/// Reads the data.
pub(crate) fn read_local_repository_index(path: &Path) -> DesktopLocalRepositoryIndex {
    fs::read_to_string(path)
        .ok()
        .and_then(|value| serde_json::from_str::<DesktopLocalRepositoryIndex>(&value).ok())
        .map(normalize_local_repository_index)
        .unwrap_or_default()
}

/// Writes the data.
pub(crate) fn write_local_repository_index(
    path: &Path,
    index: &DesktopLocalRepositoryIndex,
) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!("failed to create NekoGit local repository directory: {error}")
        })?;
    }

    let value = serde_json::to_vec_pretty(index)
        .map_err(|error| format!("failed to serialize NekoGit local repositories: {error}"))?;
    let temporary_path = path.with_extension("tmp");
    fs::write(&temporary_path, value)
        .map_err(|error| format!("failed to write NekoGit local repositories: {error}"))?;
    fs::rename(&temporary_path, path)
        .map_err(|error| format!("failed to save NekoGit local repositories: {error}"))
}
