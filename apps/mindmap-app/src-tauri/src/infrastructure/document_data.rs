use crate::domain::{BranchSide, MindMap, Node};
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentData {
    version: u8,
    root_id: String,
    nodes: Vec<NodeData>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct NodeData {
    id: String,
    parent_id: Option<String>,
    title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    side: Option<SideData>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
enum SideData {
    Left,
    Right,
}

impl From<DocumentData> for MindMap {
    fn from(data: DocumentData) -> Self {
        Self {
            version: data.version,
            root_id: data.root_id,
            nodes: data
                .nodes
                .into_iter()
                .map(|node| Node {
                    id: node.id,
                    parent_id: node.parent_id,
                    title: node.title,
                    side: node.side.map(|side| match side {
                        SideData::Left => BranchSide::Left,
                        SideData::Right => BranchSide::Right,
                    }),
                })
                .collect(),
        }
    }
}

impl From<&MindMap> for DocumentData {
    fn from(document: &MindMap) -> Self {
        Self {
            version: document.version,
            root_id: document.root_id.clone(),
            nodes: document
                .nodes
                .iter()
                .map(|node| NodeData {
                    id: node.id.clone(),
                    parent_id: node.parent_id.clone(),
                    title: node.title.clone(),
                    side: node.side.map(|side| match side {
                        BranchSide::Left => SideData::Left,
                        BranchSide::Right => SideData::Right,
                    }),
                })
                .collect(),
        }
    }
}
