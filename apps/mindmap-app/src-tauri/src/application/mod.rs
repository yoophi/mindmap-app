use crate::domain::MindMap;

pub trait DocumentStore {
    fn read(&self) -> Result<MindMap, String>;
    fn write(&self, document: &MindMap) -> Result<(), String>;
}

pub fn open_document(store: &impl DocumentStore) -> Result<MindMap, String> {
    let document = store.read()?;
    document.validate()?;
    Ok(document)
}

pub fn save_document(store: &impl DocumentStore, document: &MindMap) -> Result<(), String> {
    document.validate()?;
    store.write(document)
}
