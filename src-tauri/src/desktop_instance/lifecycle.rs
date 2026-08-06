//! Manages the single-instance lifecycle: acquiring the lock or activating the existing instance.

use std::{fs, path::Path};

use tauri::Runtime;

use super::{
    activation::{notify_existing_instance, start_instance_activation_listener},
    lock::try_lock_instance_file,
    types::{DesktopInstance, DesktopInstanceActivationHandlers, InstanceStartup},
};

const INSTANCE_ACTIVATION_FILE: &str = "instance.port";
const INSTANCE_LOCK_FILE: &str = "instance.lock";

/// Attempts to acquire the instance lock; if already locked, notifies the running instance.
pub(crate) fn claim_or_activate_instance<R: Runtime + 'static>(
    app: &tauri::App<R>,
    data_dir: &Path,
    launch_url: Option<&str>,
    start_hidden: bool,
    handlers: DesktopInstanceActivationHandlers<R>,
) -> Result<InstanceStartup, String> {
    let lock_file = data_dir.join(INSTANCE_LOCK_FILE);
    let activation_file = data_dir.join(INSTANCE_ACTIVATION_FILE);

    match try_lock_instance_file(&lock_file)? {
        Some(lock_file) => {
            let _ = fs::remove_file(&activation_file);
            start_instance_activation_listener(app, &activation_file, handlers)?;

            Ok(InstanceStartup::Primary(DesktopInstance {
                _lock_file: lock_file,
                activation_file,
            }))
        }
        None => {
            if !start_hidden {
                notify_existing_instance(&activation_file, launch_url)?;
            }
            Ok(InstanceStartup::Secondary)
        }
    }
}
