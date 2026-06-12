use std::{fs, path::PathBuf};

use tauri::{Manager, Runtime};

pub(super) fn path_to_display_string(path: &std::path::Path) -> String {
    path.to_string_lossy().into_owned()
}

pub(crate) fn app_data_root_path<R: Runtime, M: Manager<R>>(
    manager: &M,
) -> Result<PathBuf, String> {
    let app_data_dir = manager
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve app data directory: {error}"))?;
    fs::create_dir_all(&app_data_dir)
        .map_err(|error| format!("failed to create app data directory: {error}"))?;

    Ok(app_data_dir)
}
