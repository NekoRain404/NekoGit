//! Path normalization for Local git repository operations / Path resolution.

use std::path::{Component, Path, PathBuf};

/// Repository relative path string.
pub(crate) fn repository_relative_path_string(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

/// Normalizes the input.
pub(crate) fn normalize_repository_relative_path(value: &str) -> Result<PathBuf, String> {
    if value.chars().any(char::is_control) {
        return Err("repository path contains unsupported control characters".to_owned());
    }

    let normalized_value = value.trim().replace('\\', "/");
    let raw_path = Path::new(&normalized_value);
    let mut normalized_path = PathBuf::new();

    for component in raw_path.components() {
        match component {
            Component::Normal(segment) => normalized_path.push(segment),
            Component::CurDir => {}
            Component::ParentDir => {
                return Err("repository path must stay inside the local repository".to_owned());
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err("repository path must be relative".to_owned());
            }
        }
    }

    Ok(normalized_path)
}
