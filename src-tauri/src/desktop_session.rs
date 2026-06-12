use std::{env, fs, fs::OpenOptions, io::Write, path::Path};

#[cfg(unix)]
use std::os::unix::fs::OpenOptionsExt;

pub(crate) const SESSION_SECRET_FILE: &str = "session.secret";

const MIN_SESSION_PASSWORD_CHARS: usize = 32;
const SESSION_SECRET_BYTES: usize = 32;

fn validate_session_password(value: &str) -> Result<String, String> {
    let value = value.trim();
    if value.len() < MIN_SESSION_PASSWORD_CHARS {
        return Err(format!(
            "NUXT_SESSION_PASSWORD must be at least {MIN_SESSION_PASSWORD_CHARS} characters"
        ));
    }

    Ok(value.to_owned())
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);

    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }

    output
}

fn create_session_password() -> Result<String, String> {
    let mut bytes = [0_u8; SESSION_SECRET_BYTES];
    getrandom::fill(&mut bytes)
        .map_err(|error| format!("failed to generate desktop session secret: {error}"))?;
    Ok(hex_encode(&bytes))
}

fn read_session_password_file(path: &Path) -> Result<Option<String>, String> {
    if !path.is_file() {
        return Ok(None);
    }

    let value = fs::read_to_string(path)
        .map_err(|error| format!("failed to read desktop session secret: {error}"))?;
    validate_session_password(&value).map(Some)
}

fn write_session_password_file(path: &Path, value: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create session secret directory: {error}"))?;
    }

    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    options.mode(0o600);

    let mut file = options.open(path).map_err(|error| {
        format!(
            "failed to create desktop session secret `{}`: {error}",
            path.display()
        )
    })?;
    file.write_all(value.as_bytes())
        .and_then(|_| file.write_all(b"\n"))
        .map_err(|error| format!("failed to write desktop session secret: {error}"))
}

/// Reads or generates the session encryption password, persisted across restarts.
pub(crate) fn resolve_session_password(secret_path: &Path) -> Result<String, String> {
    if let Ok(value) = env::var("NUXT_SESSION_PASSWORD") {
        return validate_session_password(&value);
    }

    if let Some(value) = read_session_password_file(secret_path)? {
        return Ok(value);
    }

    let value = create_session_password()?;
    match write_session_password_file(secret_path, &value) {
        Ok(()) => Ok(value),
        Err(error) if secret_path.is_file() => {
            read_session_password_file(secret_path)?.ok_or(error)
        }
        Err(error) => Err(error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_random_bytes_as_lowercase_hex() {
        assert_eq!(hex_encode(&[0, 1, 15, 16, 255]), "00010f10ff");
    }

    #[test]
    fn requires_session_passwords_to_be_long_enough() {
        assert!(validate_session_password(&"a".repeat(MIN_SESSION_PASSWORD_CHARS)).is_ok());
        assert!(validate_session_password(&"a".repeat(MIN_SESSION_PASSWORD_CHARS - 1)).is_err());
    }
}
