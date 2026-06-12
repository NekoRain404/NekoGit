//! Single-instance enforcement: claims the process lock or activates the running instance.

mod activation;
mod args;
mod lifecycle;
mod lock;
mod types;

pub(crate) use args::current_start_hidden;
pub(crate) use lifecycle::claim_or_activate_instance;
pub(crate) use types::{DesktopInstanceActivationHandlers, InstanceStartup};
