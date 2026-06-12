//! Branch status parsing for Local git repository operations / Output parsing.

pub(super) fn parse_local_repository_git_branch_line(
    line: &str,
) -> (Option<String>, Option<String>, u32, u32) {
    let mut branch_text = line.trim_start_matches("## ").trim();
    let mut ahead = 0;
    let mut behind = 0;

    if branch_text.ends_with(']') {
        if let Some(marker_start) = branch_text.rfind(" [") {
            let marker_text = &branch_text[marker_start + 2..branch_text.len() - 1];
            branch_text = branch_text[..marker_start].trim();

            for marker in marker_text.split(',').map(str::trim) {
                if let Some(value) = marker.strip_prefix("ahead ") {
                    ahead = value.trim().parse::<u32>().unwrap_or(0);
                } else if let Some(value) = marker.strip_prefix("behind ") {
                    behind = value.trim().parse::<u32>().unwrap_or(0);
                }
            }
        }
    }

    if let Some(branch) = branch_text.strip_prefix("No commits yet on ") {
        let branch = branch.trim();
        return (
            (!branch.is_empty()).then(|| branch.to_owned()),
            None,
            ahead,
            behind,
        );
    }

    let (branch, upstream) = branch_text
        .split_once("...")
        .map(|(branch, upstream)| (branch.trim(), Some(upstream.trim())))
        .unwrap_or_else(|| (branch_text, None));
    let branch = (!branch.is_empty()).then(|| branch.to_owned());
    let upstream = upstream.and_then(|value| (!value.is_empty()).then(|| value.to_owned()));

    (branch, upstream, ahead, behind)
}
