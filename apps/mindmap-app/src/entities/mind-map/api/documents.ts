import { invoke } from "@tauri-apps/api/core";
import type { MindMap } from "../model/document";

export function openDocument() {
  return invoke<{ document: MindMap; path: string } | null>("open_mind_map");
}

export function saveDocument(document: MindMap, previousPath: string | null) {
  return invoke<string | null>("save_mind_map", { document, previousPath });
}
