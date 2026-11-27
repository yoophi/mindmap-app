use crate::{
    application::{open_document, save_document},
    domain::MindMap,
    infrastructure::{DocumentData, JsonFileStore},
};
use serde::Serialize;
use std::path::Path;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize)]
pub struct OpenedDocument {
    document: DocumentData,
    path: String,
}

#[tauri::command]
pub async fn open_mind_map(app: AppHandle) -> Result<Option<OpenedDocument>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(selected) = app
            .dialog()
            .file()
            .set_title("Open mind map")
            .add_filter("Mindmap document", &["json"])
            .blocking_pick_file()
        else {
            return Ok(None);
        };
        let path = selected.into_path().map_err(|error| error.to_string())?;
        let document = open_document(&JsonFileStore::new(path.clone()))?;
        Ok(Some(OpenedDocument {
            document: DocumentData::from(&document),
            path: path.to_string_lossy().into_owned(),
        }))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn save_mind_map(
    app: AppHandle,
    document: DocumentData,
    previous_path: Option<String>,
) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let document = MindMap::from(document);
        let mut dialog = app
            .dialog()
            .file()
            .set_title("Save mind map")
            .add_filter("Mindmap document", &["json"])
            .set_file_name("Untitled.mindmap.json");
        if let Some(previous_path) = previous_path.as_deref().map(Path::new) {
            if let Some(name) = previous_path.file_name().and_then(|name| name.to_str()) {
                dialog = dialog.set_file_name(name);
            }
            if let Some(directory) = previous_path.parent() {
                dialog = dialog.set_directory(directory);
            }
        }

        let Some(selected) = dialog.blocking_save_file() else {
            return Ok(None);
        };
        let path = selected.into_path().map_err(|error| error.to_string())?;
        save_document(&JsonFileStore::new(path.clone()), &document)?;
        Ok(Some(path.to_string_lossy().into_owned()))
    })
    .await
    .map_err(|error| error.to_string())?
}
