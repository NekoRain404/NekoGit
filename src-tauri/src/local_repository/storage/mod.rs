//! Remembered local repository state: JSON index, cleanup, and display-safe path conversion.
mod display;
mod index;
mod paths;
mod status;
mod time;

pub(crate) use display::path_to_display_string;
pub(crate) use status::{local_repository_status, remember_local_repository};
#[cfg(test)]
pub(crate) use time::unix_timestamp_secs;
