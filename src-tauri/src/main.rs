#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! Binary entry point for the NekoGit desktop application.

/// Entry point for the NekoGit desktop application.
fn main() {
    nekogit_client_lib::run();
}
