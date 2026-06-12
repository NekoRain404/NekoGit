const GITHUB_WEB_RESERVED_OWNER_SEGMENTS: &[&str] = &[
    "apps",
    "codespaces",
    "collections",
    "dashboard",
    "enterprise",
    "explore",
    "features",
    "gist",
    "issues",
    "join",
    "login",
    "marketplace",
    "new",
    "notifications",
    "orgs",
    "organizations",
    "pricing",
    "pulls",
    "search",
    "settings",
    "sponsors",
    "topics",
    "trending",
];

pub(crate) fn is_reserved_github_web_owner_segment(value: &str) -> bool {
    GITHUB_WEB_RESERVED_OWNER_SEGMENTS
        .iter()
        .any(|segment| segment.eq_ignore_ascii_case(value))
}
