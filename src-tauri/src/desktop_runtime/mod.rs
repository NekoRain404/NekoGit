//! Runtime metadata and diagnostics for the desktop client environment.
mod diagnostics;
mod paths;
mod types;

pub(crate) use diagnostics::{format_desktop_diagnostics_report, DesktopDiagnostics};
pub(crate) use paths::app_data_root_path;
pub(crate) use types::{DesktopRuntime, DesktopRuntimeInfo};
