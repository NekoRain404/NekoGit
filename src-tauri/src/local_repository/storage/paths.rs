//! Runtime path resolution for Local git repository operations / Local storage management.

use std::path::{Path, PathBuf};

use crate::local_repository::types::LOCAL_REPOSITORIES_FILE;

/// Local repositories index path.
pub(crate) fn local_repositories_index_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(LOCAL_REPOSITORIES_FILE)
}
