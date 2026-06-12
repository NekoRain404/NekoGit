use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

use super::{validation::normalize_window_state, DesktopWindowState};

pub(crate) struct DesktopWindowStateStore {
    path: PathBuf,
    state: Mutex<Option<DesktopWindowState>>,
}

fn read_desktop_window_state(path: &Path) -> Option<DesktopWindowState> {
    let value = fs::read_to_string(path).ok()?;
    let state = serde_json::from_str::<DesktopWindowState>(&value).ok()?;
    normalize_window_state(state)
}

fn write_desktop_window_state(path: &Path, state: &DesktopWindowState) -> Result<(), String> {
    let state = normalize_window_state(*state)
        .ok_or_else(|| "refusing to write invalid NekoGit window state".to_owned())?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create window state directory: {error}"))?;
    }

    let value = serde_json::to_vec_pretty(&state)
        .map_err(|error| format!("failed to serialize NekoGit window state: {error}"))?;
    let temporary_path = path.with_extension("tmp");
    fs::write(&temporary_path, value)
        .map_err(|error| format!("failed to write NekoGit window state: {error}"))?;
    fs::rename(&temporary_path, path)
        .map_err(|error| format!("failed to save NekoGit window state: {error}"))
}

impl DesktopWindowStateStore {
    pub(crate) fn new(path: PathBuf) -> Self {
        let state = read_desktop_window_state(&path);

        Self {
            path,
            state: Mutex::new(state),
        }
    }

    pub(crate) fn current(&self) -> Option<DesktopWindowState> {
        self.state.lock().ok().and_then(|state| *state)
    }

    pub(super) fn update(&self, state: DesktopWindowState) -> Result<(), String> {
        let state = normalize_window_state(state)
            .ok_or_else(|| "refusing to store invalid NekoGit window state".to_owned())?;
        write_desktop_window_state(&self.path, &state)?;
        let mut current = self
            .state
            .lock()
            .map_err(|_| "failed to lock NekoGit window state".to_owned())?;
        *current = Some(state);

        Ok(())
    }
}
