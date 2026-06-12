//! GitHub clone URL canonicalization, reserved-path exclusion, and destination derivation.
mod destination;
mod normalize;
mod reserved;

pub(crate) use destination::clone_destination_path;
pub(crate) use normalize::normalize_github_repository_clone_url;
