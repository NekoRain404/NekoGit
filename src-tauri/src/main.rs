#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// Entry point for the NekoGit desktop application.
fn main() {
    nekogit_client_lib::run();
}
