use tauri::Url;

pub(crate) fn dashboard_url_for_github_launch(
    client_url: &str,
    target_url: &str,
) -> Result<Url, String> {
    let mut url: Url = client_url
        .parse()
        .map_err(|error| format!("invalid desktop client URL `{client_url}`: {error}"))?;

    url.set_path("/dashboard");
    url.set_query(None);
    url.set_fragment(None);
    url.query_pairs_mut().append_pair("url", target_url);

    Ok(url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_dashboard_launch_url() {
        let url = dashboard_url_for_github_launch(
            "http://127.0.0.1:3000/",
            "https://github.com/owner/repo/issues/42#comment",
        )
        .unwrap();

        assert_eq!(
            url.as_str(),
            "http://127.0.0.1:3000/dashboard?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo%2Fissues%2F42%23comment"
        );
    }
}
