//! Server configuration for Desktop server management.

use std::{env, path::PathBuf};

use getrandom::fill as fill_random;

use super::types::DesktopServerConfig;

/// Generate a high-entropy readiness token for the desktop health probe.
pub(super) fn generate_desktop_readiness_token() -> Result<String, String> {
    let mut bytes = [0u8; 32];
    fill_random(&mut bytes).map_err(|error| format!("failed to generate readiness token: {error}"))?;
    Ok(hex_encode(&bytes))
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push(HEX[(byte >> 4) as usize] as char);
        out.push(HEX[(byte & 0xf) as usize] as char);
    }
    out
}

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
    let user_settings_storage_driver =
        inherited_env_or("NUXT_NEKOGIT_USER_SETTINGS_STORAGE_DRIVER", "fs");
    let user_settings_storage_base = inherited_env_or(
        "NUXT_NEKOGIT_USER_SETTINGS_STORAGE_BASE",
        &user_settings_dir.to_string_lossy(),
    );

    let readiness_token = generate_desktop_readiness_token()?;

    Ok(DesktopServerConfig {
        server_entry,
        server_dir,
        node_binary,
        server_log_path,
        session_password,
        readiness_token,
        personal_mode_enabled,
        token_enabled,
        oauth_requested,
        user_settings_storage_driver,
        user_settings_storage_base,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_hex_readiness_tokens_of_expected_length() {
        let token = generate_desktop_readiness_token().expect("token");
        assert_eq!(token.len(), 64);
        assert!(token.chars().all(|c| c.is_ascii_hexdigit()));
        let other = generate_desktop_readiness_token().expect("other token");
        assert_ne!(token, other);
    }
}
