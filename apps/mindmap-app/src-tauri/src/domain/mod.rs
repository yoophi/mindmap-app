use std::collections::{HashMap, HashSet};

const VERSION: u8 = 1;
const MAX_NODES: usize = 1000;
const MAX_DEPTH: usize = 64;
const MAX_TITLE_LENGTH: usize = 160;

#[derive(Debug, PartialEq, Eq)]
pub struct MindMap {
    pub version: u8,
    pub root_id: String,
    pub nodes: Vec<Node>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BranchSide {
    Left,
    Right,
}

#[derive(Debug, PartialEq, Eq)]
pub struct Node {
    pub id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub side: Option<BranchSide>,
}

impl MindMap {
    pub fn validate(&self) -> Result<(), &'static str> {
        if self.version != VERSION {
            return Err("Unsupported document version.");
        }
        if self.nodes.is_empty() || self.nodes.len() > MAX_NODES {
            return Err("A document must contain between 1 and 1,000 nodes.");
        }

        let mut ids = HashSet::new();
        let mut root_found = false;
        let mut children = HashMap::<&str, Vec<&str>>::new();

        for node in &self.nodes {
            let id = node.id.as_str();
            if id.trim().is_empty() || id.len() > 128 || !ids.insert(id) {
                return Err("The document contains an invalid or duplicate node ID.");
            }
            if node.title.trim().is_empty() || node.title.chars().count() > MAX_TITLE_LENGTH {
                return Err("Every node needs a title of at most 160 characters.");
            }
            if node.side.is_some() && node.parent_id.as_deref() != Some(self.root_id.as_str()) {
                return Err("Only a branch attached to the root can have a side.");
            }
            match (id == self.root_id, node.parent_id.as_deref()) {
                (true, None) => root_found = true,
                (false, Some(parent)) => children.entry(parent).or_default().push(id),
                _ => return Err("The document must have exactly one root node."),
            }
        }

        if !root_found {
            return Err("The document root is missing.");
        }

        let mut stack = vec![(self.root_id.as_str(), 0)];
        let mut reachable = 0;
        while let Some((id, depth)) = stack.pop() {
            if depth > MAX_DEPTH {
                return Err("The document exceeds the maximum depth of 64.");
            }
            reachable += 1;
            if let Some(descendants) = children.get(id) {
                stack.extend(descendants.iter().map(|child| (*child, depth + 1)));
            }
        }

        if reachable != self.nodes.len() {
            return Err("The document contains disconnected nodes or a cycle.");
        }
        Ok(())
    }
}
