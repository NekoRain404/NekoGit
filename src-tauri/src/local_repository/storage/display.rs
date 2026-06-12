//! Display name formatting for Local git repository operations / Local storage management.

use std::path::Path;

/// Returns the file path.
pub(crate) fn path_to_display_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}
