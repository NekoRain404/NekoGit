pub(crate) fn git_diff_pathspecs(path: &str, previous_path: Option<&str>) -> Vec<String> {
    let mut pathspecs = Vec::new();
    if let Some(previous_path) = previous_path {
        if previous_path != path {
            pathspecs.push(previous_path.to_owned());
        }
    }
    pathspecs.push(path.to_owned());
    pathspecs
}
