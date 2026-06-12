//! Deep link (`nekogit://`) and external URL handling, including activation and GitHub link routing.
mod activation;
mod dashboard;
mod deep_link;
mod github;

pub(crate) use activation::{
    activation_message, current_launch_target_url, parse_activation_request, ActivationRequest,
};
pub(crate) use dashboard::dashboard_url_for_github_launch;
pub(crate) use github::{is_nekogit_dashboard_github_target_url, normalize_supported_github_url};
