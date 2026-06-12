//! Repository-relative path safety: normalization, containment checks, and status resolution.
mod normalize;
mod resolve;
mod status;

pub(crate) use normalize::{normalize_repository_relative_path, repository_relative_path_string};
pub(crate) use resolve::validated_repository_file_path;
pub(crate) use status::local_repository_path_status;
