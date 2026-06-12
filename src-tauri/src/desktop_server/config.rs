use std::{env, path::PathBuf};

use super::types::DesktopServerConfig;

pub(super) fn inherited_env_or(name: &str, default_value: &str) -> String {
    env::var(name).unwrap_or_else(|_| default_value.to_owned())
}

fn inherited_env_or_any(names: &[&str], default_value: &str) -> String {
    names
        .iter()
        .find_map(|name| env::var(name).ok())
        .unwrap_or_else(|| default_value.to_owned())
}

fn normalize_boolean(value: &str, default_value: bool) -> bool {
    match value.trim().to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "on" => true,
        "0" | "false" | "no" | "off" => false,
        _ => default_value,
    }
}

fn inherited_bool_or_any(names: &[&str], default_value: bool) -> bool {
    names
        .iter()
        .find_map(|name| env::var(name).ok())
        .map(|value| normalize_boolean(&value, default_value))
        .unwrap_or(default_value)
}

pub(super) fn bool_env_value(value: bool) -> &'static str {
    if value {
        "true"
    } else {
        "false"
    }
}

fn has_non_blank_env(name: &str) -> bool {
    env::var(name)
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
}

pub(super) fn create_desktop_server_config(
    server_entry: PathBuf,
    node_binary: PathBuf,
    server_log_path: PathBuf,
    user_settings_dir: PathBuf,
    session_password: String,
) -> Result<DesktopServerConfig, String> {
    let server_dir = server_entry
        .parent()
        .ok_or_else(|| "bundled NekoGit server entry has no parent directory".to_owned())?
        .to_path_buf();
    let personal_mode_enabled = inherited_env_or_any(
        &[
            "NUXT_GIT_PULSE_AUTH_PERSONAL_MODE_ENABLED",
            "NUXT_AUTH_PERSONAL_MODE_ENABLED",
        ],
        "false",
    );
    let token_enabled = inherited_env_or_any(
        &["NUXT_GIT_PULSE_AUTH_TOKEN_ENABLED", "NUXT_AUTH_PAT_ENABLED"],
        "true",
    );
    let oauth_requested = inherited_bool_or_any(
        &[
            "NUXT_GIT_PULSE_AUTH_GITHUB_OAUTH_REQUESTED",
            "NUXT_AUTH_GITHUB_OAUTH_ENABLED",
        ],
        false,
    );
    let oauth_env_ready = inherited_bool_or_any(
        &["NUXT_GIT_PULSE_AUTH_GITHUB_OAUTH_ENV_READY"],
        has_non_blank_env("NUXT_OAUTH_GITHUB_CLIENT_ID")
            && has_non_blank_env("NUXT_OAUTH_GITHUB_CLIENT_SECRET"),
    );
    let oauth_enabled = inherited_bool_or_any(
        &["NUXT_GIT_PULSE_AUTH_GITHUB_OAUTH_ENABLED"],
        oauth_requested && oauth_env_ready,
    );
    let user_settings_storage_driver =
        inherited_env_or("NUXT_NEKOGIT_USER_SETTINGS_STORAGE_DRIVER", "fs");
    let user_settings_storage_base = inherited_env_or(
        "NUXT_NEKOGIT_USER_SETTINGS_STORAGE_BASE",
        &user_settings_dir.to_string_lossy(),
    );

    Ok(DesktopServerConfig {
        server_entry,
        server_dir,
        node_binary,
        server_log_path,
        session_password,
        personal_mode_enabled,
        token_enabled,
        oauth_requested,
        oauth_env_ready,
        oauth_enabled,
        user_settings_storage_driver,
        user_settings_storage_base,
    })
}
