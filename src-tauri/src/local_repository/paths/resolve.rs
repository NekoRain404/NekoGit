use std::path::{Path, PathBuf};

pub(crate) fn validated_repository_file_path(
    repository_path: &str,
    normalized_relative_path: &Path,
) -> Result<PathBuf, String> {
    let repository_root = PathBuf::from(repository_path);
    let local_path = repository_root.join(normalized_relative_path);
    if !local_path.starts_with(&repository_root) {
        return Err("repository path must stay inside the local repository".to_owned());
    }

    Ok(local_path)
}
