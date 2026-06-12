use std::path::Path;

pub(crate) fn path_to_display_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}
