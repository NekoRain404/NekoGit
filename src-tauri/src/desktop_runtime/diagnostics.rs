use crate::{desktop_autostart::DesktopAutostartStatus, desktop_server::DesktopServerStatus};

use super::types::DesktopRuntimeInfo;

pub(crate) struct DesktopDiagnostics {
    pub(crate) runtime: DesktopRuntimeInfo,
    pub(crate) server_status: DesktopServerStatus,
    pub(crate) autostart_status: DesktopAutostartStatus,
}

fn optional_diagnostic_value<T: ToString>(value: Option<T>) -> String {
    value
        .map(|value| value.to_string())
        .unwrap_or_else(|| "-".to_owned())
}

fn bool_diagnostic_value(value: bool) -> &'static str {
    if value {
        "yes"
    } else {
        "no"
    }
}

pub(crate) fn format_desktop_diagnostics_report(diagnostics: &DesktopDiagnostics) -> String {
    let runtime = &diagnostics.runtime;
    let server = &diagnostics.server_status;
    let autostart = &diagnostics.autostart_status;

    [
        "NekoGit Desktop Diagnostics".to_owned(),
        format!("Product: {}", runtime.product_name),
        format!("Version: {}", runtime.version),
        format!("Platform: {}", runtime.platform),
        format!(
            "Debug build: {}",
            bool_diagnostic_value(runtime.debug_build)
        ),
        format!(
            "Bundled server: {}",
            bool_diagnostic_value(runtime.bundled_server)
        ),
        format!(
            "External client: {}",
            bool_diagnostic_value(runtime.external_client)
        ),
        format!("Client URL: {}", runtime.client_url),
        format!("App data directory: {}", runtime.app_data_dir),
        format!("Webview data directory: {}", runtime.webview_data_dir),
        format!("User settings directory: {}", runtime.user_settings_dir),
        format!("Server log: {}", runtime.server_log_path),
        format!(
            "Server entry: {}",
            optional_diagnostic_value(runtime.server_entry.as_deref())
        ),
        format!(
            "Node runtime: {}",
            optional_diagnostic_value(runtime.node_binary.as_deref())
        ),
        format!("Server running: {}", bool_diagnostic_value(server.running)),
        format!("Server PID: {}", optional_diagnostic_value(server.pid)),
        format!("Server port: {}", optional_diagnostic_value(server.port)),
        format!(
            "Server address: {}",
            optional_diagnostic_value(server.address.as_deref())
        ),
        format!(
            "Server client URL: {}",
            optional_diagnostic_value(server.client_url.as_deref())
        ),
        format!("Server status log: {}", server.log_path),
        format!(
            "Server last exit: {}",
            optional_diagnostic_value(server.last_exit_status.as_deref())
        ),
        format!(
            "Autostart supported: {}",
            bool_diagnostic_value(autostart.supported)
        ),
        format!(
            "Autostart enabled: {}",
            bool_diagnostic_value(autostart.enabled)
        ),
        format!(
            "Autostart entry: {}",
            optional_diagnostic_value(autostart.path.as_deref())
        ),
    ]
    .join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_desktop_diagnostics_report_without_sensitive_values() {
        let diagnostics = DesktopDiagnostics {
            runtime: DesktopRuntimeInfo {
                product_name: "NekoGit",
                version: "0.1.0",
                platform: "linux",
                client_url: "http://127.0.0.1:43210".to_owned(),
                app_data_dir: "/tmp/nekogit/data".to_owned(),
                server_log_path: "/tmp/nekogit/server.log".to_owned(),
                webview_data_dir: "/tmp/nekogit/webview".to_owned(),
                user_settings_dir: "/tmp/nekogit/settings".to_owned(),
                server_entry: Some("/opt/nekogit/server/index.mjs".to_owned()),
                node_binary: Some("/opt/nekogit/node".to_owned()),
                bundled_server: true,
                external_client: false,
                debug_build: true,
            },
            server_status: DesktopServerStatus {
                bundled_server: true,
                running: true,
                pid: Some(12345),
                port: Some(43210),
                address: Some("127.0.0.1:43210".to_owned()),
                client_url: Some("http://127.0.0.1:43210".to_owned()),
                log_path: "/tmp/nekogit/server.log".to_owned(),
                last_exit_status: None,
            },
            autostart_status: DesktopAutostartStatus {
                supported: true,
                enabled: true,
                path: Some("/home/user/.config/autostart/NekoGit.desktop".to_owned()),
            },
        };

        let report = format_desktop_diagnostics_report(&diagnostics);

        assert!(report.contains("NekoGit Desktop Diagnostics"));
        assert!(report.contains("Product: NekoGit"));
        assert!(report.contains("Version: 0.1.0"));
        assert!(report.contains("Bundled server: yes"));
        assert!(report.contains("Server running: yes"));
        assert!(report.contains("Server PID: 12345"));
        assert!(report.contains("Server port: 43210"));
        assert!(report.contains("Server last exit: -"));
        assert!(report.contains("Autostart supported: yes"));
        assert!(report.contains("Autostart enabled: yes"));
        assert!(!report.contains("NUXT_SESSION_PASSWORD"));
        assert!(!report.contains("session_password"));
        assert!(!report.contains("github_pat_"));
        assert!(!report.contains("ghp_"));
    }
}
