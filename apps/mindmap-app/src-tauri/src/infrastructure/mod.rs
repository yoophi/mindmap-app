mod document_data;
pub use document_data::DocumentData;

use crate::{application::DocumentStore, domain::MindMap};
use std::{
    fs::File,
    io::{BufWriter, Read, Write},
    path::PathBuf,
};

const MAX_DOCUMENT_BYTES: u64 = 4 * 1024 * 1024;

pub struct JsonFileStore {
    path: PathBuf,
}

impl JsonFileStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }
}

impl DocumentStore for JsonFileStore {
    fn read(&self) -> Result<MindMap, String> {
        let file =
            File::open(&self.path).map_err(|error| format!("Could not open the file: {error}"))?;
        let mut contents = Vec::new();
        file.take(MAX_DOCUMENT_BYTES + 1)
            .read_to_end(&mut contents)
            .map_err(|error| format!("Could not read the file: {error}"))?;
        if contents.len() as u64 > MAX_DOCUMENT_BYTES {
            return Err("The document exceeds the 4 MiB file limit.".into());
        }
        serde_json::from_slice::<DocumentData>(&contents)
            .map(Into::into)
            .map_err(|error| format!("The file is not a valid Mindmap document: {error}"))
    }

    fn write(&self, document: &MindMap) -> Result<(), String> {
        let directory = self
            .path
            .parent()
            .filter(|parent| !parent.as_os_str().is_empty())
            .ok_or("The save path has no parent directory.")?;
        let mut temp = tempfile::NamedTempFile::new_in(directory)
            .map_err(|error| format!("Could not create the save file: {error}"))?;
        {
            let mut writer = BufWriter::new(temp.as_file_mut());
            serde_json::to_writer_pretty(&mut writer, &DocumentData::from(document))
                .map_err(|error| format!("Could not write the document: {error}"))?;
            writer
                .write_all(b"\n")
                .and_then(|()| writer.flush())
                .map_err(|error| format!("Could not flush the document: {error}"))?;
        }
        temp.as_file()
            .sync_all()
            .map_err(|error| format!("Could not sync the save file: {error}"))?;
        temp.persist(&self.path)
            .map_err(|error| format!("Could not replace the save file: {error}"))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::{open_document, save_document};

    #[test]
    fn round_trip_overwrite_preserves_unicode_and_tree() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("test.mindmap.json");
        let store = JsonFileStore::new(path);
        let mut document = MindMap::from(serde_json::from_str::<DocumentData>(
            r#"{"version":1,"rootId":"root","nodes":[{"id":"root","parentId":null,"title":"마인드맵"},{"id":"child","parentId":"root","title":"아이디어","side":"left"}]}"#,
        )
        .unwrap());

        save_document(&store, &document).unwrap();
        assert_eq!(open_document(&store).unwrap(), document);
        document.nodes[1].title = "Updated node".to_owned();
        save_document(&store, &document).unwrap();
        assert_eq!(open_document(&store).unwrap(), document);
        assert_eq!(directory.path().read_dir().unwrap().count(), 1);
    }

    #[test]
    fn invalid_tree_cannot_replace_a_saved_document() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("test.mindmap.json");
        let store = JsonFileStore::new(path.clone());
        let mut document = MindMap::from(serde_json::from_str::<DocumentData>(
            r#"{"version":1,"rootId":"root","nodes":[{"id":"root","parentId":null,"title":"Root"},{"id":"child","parentId":"root","title":"Child"}]}"#,
        )
        .unwrap());
        save_document(&store, &document).unwrap();
        document.nodes[1].parent_id = Some("child".to_owned());

        assert!(save_document(&store, &document).is_err());
        assert_eq!(
            open_document(&store).unwrap().nodes[1].parent_id.as_deref(),
            Some("root")
        );
        std::fs::write(
            &path,
            serde_json::to_vec(&DocumentData::from(&document)).unwrap(),
        )
        .unwrap();
        assert!(open_document(&store).is_err());
    }
}
