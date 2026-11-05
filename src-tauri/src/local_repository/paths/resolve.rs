//! Path resolution for Local git repository operations / Path resolution.

use std::{
    fs, io,
    path::{Path, PathBuf},
};

/// Ensure a repository-relative path resolves inside the canonical repository root.
///
/// Every existing path component is inspected. If a component is a symlink, its
/// canonical target must stay inside the repository; dangling symlinks are
/// rejected because their target cannot be validated. Non-existent components
/// (the usual case for new files) are allowed once all existing ancestors have
/// been validated.
pub(crate) fn ensure_repository_path_within_root(
    repository_root: &Path,
    local_path: &Path,
) -> Result<(), String> {
    let canonical_root = fs::canonicalize(repository_root).map_err(|error| {
        format!(
            "failed to resolve local repository root {}: {error}",
            repository_root.display()
        )
    })?;
    let relative_path = local_path
        .strip_prefix(repository_root)
        .map_err(|_| "repository path must stay inside the local repository".to_owned())?;

    let mut current = repository_root.to_path_buf();
    for component in relative_path.components() {
        current.push(component);

        match fs::symlink_metadata(&current) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                let canonical_path = fs::canonicalize(&current).map_err(|error| {
                    format!(
                        "failed to resolve repository symlink {}: {error}",
                        current.display()
                    )
                })?;
                if !canonical_path.starts_with(&canonical_root) {
                    return Err(format!(
                        "repository path resolves outside the local repository: {}",
                        local_path.display()
                    ));
                }
            }
            Ok(_) => {}
            // The rest of the path does not exist yet; all existing ancestors
            // have already been validated above.
            Err(error) if error.kind() == io::ErrorKind::NotFound => break,
            Err(error) => {
                return Err(format!(
                    "failed to inspect repository path {}: {error}",
                    current.display()
                ));
            }
        }
    }

    Ok(())
}

/// Validated repository file path.
pub(crate) fn validated_repository_file_path(
    repository_path: &str,
    normalized_relative_path: &Path,
) -> Result<PathBuf, String> {
    let repository_root = PathBuf::from(repository_path);
    let local_path = repository_root.join(normalized_relative_path);
    if !local_path.starts_with(&repository_root) {
        return Err("repository path must stay inside the local repository".to_owned());
    }

    ensure_repository_path_within_root(&repository_root, &local_path)?;

    Ok(local_path)
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::os::unix::fs::symlink;

    fn test_base(name: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "nekogit-resolve-test-{name}-{}-{nanos}",
            std::process::id()
        ))
    }

    #[test]
    fn accepts_paths_inside_the_repository() {
        let base = test_base("inside");
        let repository_root = base.join("repo");
        let existing_file = repository_root.join("src").join("lib.rs");
        fs::create_dir_all(existing_file.parent().unwrap()).unwrap();
        fs::write(&existing_file, "fn main() {}\n").unwrap();

        let repository_path = repository_root.to_str().unwrap();

        assert_eq!(
            validated_repository_file_path(repository_path, Path::new("src/lib.rs")).unwrap(),
            existing_file
        );
        assert_eq!(
            validated_repository_file_path(repository_path, Path::new("src/new.rs")).unwrap(),
            repository_root.join("src").join("new.rs")
        );

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn rejects_symlinked_directory_escaping_the_repository() {
        let base = test_base("escape-dir");
        let repository_root = base.join("repo");
        let outside = base.join("outside");
        fs::create_dir_all(&repository_root).unwrap();
        fs::create_dir_all(&outside).unwrap();
        fs::write(outside.join("secret.txt"), "secret\n").unwrap();
        symlink(&outside, repository_root.join("escape")).unwrap();

        let result = validated_repository_file_path(
            repository_root.to_str().unwrap(),
            Path::new("escape/secret.txt"),
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("outside the local repository"));

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn rejects_symlinked_file_escaping_the_repository() {
        let base = test_base("escape-file");
        let repository_root = base.join("repo");
        let outside = base.join("outside");
        fs::create_dir_all(&repository_root).unwrap();
        fs::create_dir_all(&outside).unwrap();
        fs::write(outside.join("secret.txt"), "secret\n").unwrap();
        symlink(
            outside.join("secret.txt"),
            repository_root.join("secret-link"),
        )
        .unwrap();

        let result = validated_repository_file_path(
            repository_root.to_str().unwrap(),
            Path::new("secret-link"),
        );

        assert!(result.is_err());

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn rejects_non_existent_path_under_escaping_symlink_parent() {
        let base = test_base("escape-missing");
        let repository_root = base.join("repo");
        let outside = base.join("outside");
        fs::create_dir_all(&repository_root).unwrap();
        fs::create_dir_all(&outside).unwrap();
        symlink(&outside, repository_root.join("escape")).unwrap();

        let result = validated_repository_file_path(
            repository_root.to_str().unwrap(),
            Path::new("escape/missing.txt"),
        );

        assert!(result.is_err());

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn rejects_dangling_symlink_parent() {
        let base = test_base("dangling");
        let repository_root = base.join("repo");
        let outside_missing = base.join("outside-missing");
        fs::create_dir_all(&repository_root).unwrap();
        symlink(&outside_missing, repository_root.join("escape")).unwrap();

        let result = validated_repository_file_path(
            repository_root.to_str().unwrap(),
            Path::new("escape/missing.txt"),
        );

        assert!(result.is_err());

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn accepts_symlinks_that_stay_inside_the_repository() {
        let base = test_base("inside-link");
        let repository_root = base.join("repo");
        let target_directory = repository_root.join("target");
        fs::create_dir_all(&target_directory).unwrap();
        fs::write(target_directory.join("file.txt"), "inside\n").unwrap();
        symlink(&target_directory, repository_root.join("link")).unwrap();

        let result = validated_repository_file_path(
            repository_root.to_str().unwrap(),
            Path::new("link/file.txt"),
        );

        assert!(result.is_ok());

        let _ = fs::remove_dir_all(&base);
    }
}
