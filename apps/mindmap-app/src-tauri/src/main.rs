#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod application;
mod domain;
mod inbound;
mod infrastructure;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            inbound::open_mind_map,
            inbound::save_mind_map
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Mindmap");
}
