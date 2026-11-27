import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  canMoveTo, demoMap, layoutMap, maxDepth, maxNodes, maxTitleLength,
  newMap, openDocument, saveDocument, type BranchSide, type MindMap,
} from "../../../entities/mind-map";

export function useEditor() {
  const [map, setMap] = useState(demoMap);
  const [savedMap, setSavedMap] = useState(map);
  const [selectedId, setSelected] = useState(map.rootId);
  const [editingId, setEditing] = useState<string | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const layout = useMemo(() => layoutMap(map), [map]);
  const selected = layout.byId.get(selectedId) ?? layout.nodes[0];
  const dirty = map !== savedMap;
  const runtimeState = useRef({ dirty, editingId });
  runtimeState.current = { dirty, editingId };

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void getCurrentWindow().onCloseRequested((event) => {
      if (busy.current || (
        (runtimeState.current.dirty || runtimeState.current.editingId !== null) &&
        !window.confirm("Close this map and discard unsaved changes?")
      )) event.preventDefault();
    }).then((stop) => {
      if (disposed) stop();
      else unlisten = stop;
    }).catch((cause: unknown) => setError(String(cause)));
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  function replaceMap(document: MindMap, filePath: string | null) {
    setMap(document);
    setSavedMap(document);
    setPath(filePath);
    setSelected(document.rootId);
    setEditing(null);
    setError(null);
  }

  function canReplace() {
    return !busy.current && (!dirty || window.confirm("Discard unsaved changes to this map?"));
  }

  async function runFileAction(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setEditing(null);
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(String(cause));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function move(id: string, parentId: string, side: BranchSide, beforeId: string | null) {
    if (busy.current) return;
    const node = layout.byId.get(id);
    const parent = layout.byId.get(parentId);
    if (!node || !parent || !canMoveTo(layout, node, parent)) return;

    const rootBranch = parentId === map.rootId;
    const direction = rootBranch ? side : parent.direction;
    const siblings = layout.nodes.filter((candidate) =>
      candidate.parentId === parentId && candidate.direction === direction,
    );
    const currentIndex = siblings.findIndex((candidate) => candidate.id === id);
    if (currentIndex >= 0 && (siblings[currentIndex + 1]?.id ?? null) === beforeId) return;

    const nodes = map.nodes.filter((candidate) => candidate.id !== id);
    const lastSibling = siblings.filter((candidate) => candidate.id !== id).pop();
    const insertAt = beforeId !== null
      ? nodes.findIndex((candidate) => candidate.id === beforeId)
      : lastSibling ? nodes.findIndex((candidate) => candidate.id === lastSibling.id) + 1 : nodes.length;
    if (insertAt < 0) return;

    nodes.splice(insertAt, 0, {
      id,
      parentId,
      title: node.title,
      side: rootBranch && direction === "left" ? "left" : undefined,
    });
    setMap({ ...map, nodes });
    setSelected(id);
  }

  function insert(sibling: boolean) {
    if (busy.current || map.nodes.length >= maxNodes) return;
    const parent = sibling ? selected.parentId : selected.id;
    if (parent === null || (!sibling && selected.depth >= maxDepth)) return;
    const id = crypto.randomUUID();
    setMap({
      ...map,
      nodes: [...map.nodes, {
        id,
        parentId: parent,
        title: "New topic",
        side: sibling && parent === map.rootId && selected.direction === "left" ? "left" : undefined,
      }],
    });
    setSelected(id);
    setEditing(id);
  }

  function remove() {
    if (busy.current || selected.parentId === null) return;
    const removed = new Set<string>([selected.id]);
    for (const node of layout.nodes) {
      if (node.parentId !== null && removed.has(node.parentId)) removed.add(node.id);
    }
    if (removed.size > 1 && !window.confirm(`Delete this topic and its ${removed.size - 1} descendants?`)) return;
    setMap({ ...map, nodes: map.nodes.filter((node) => !removed.has(node.id)) });
    setSelected(selected.parentId);
    setEditing(null);
  }

  function rename(id: string, title: string) {
    setEditing(null);
    const value = Array.from(title.trim()).slice(0, maxTitleLength).join("");
    if (busy.current || !value || layout.byId.get(id)?.title === value) return;
    setMap((current) => ({
      ...current,
      nodes: current.nodes.map((node) => node.id === id ? { ...node, title: value } : node),
    }));
  }

  return {
    map, layout, selected, editingId, path, dirty, pending, error,
    select: setSelected,
    edit: (id: string) => { setSelected(id); setEditing(id); },
    cancelEdit: () => setEditing(null),
    clearError: () => setError(null),
    rename,
    insert,
    move,
    remove,
    canAddChild: map.nodes.length < maxNodes && selected.depth < maxDepth,
    canAddSibling: map.nodes.length < maxNodes && selected.parentId !== null,
    create: () => { if (canReplace()) replaceMap(newMap(), null); },
    open: () => {
      if (canReplace()) void runFileAction(async () => {
        const opened = await openDocument();
        if (opened) replaceMap(opened.document, opened.path);
      });
    },
    save: () => {
      void runFileAction(async () => {
        const savedPath = await saveDocument(map, path);
        if (savedPath !== null) {
          setPath(savedPath);
          setSavedMap(map);
        }
      });
    },
  };
}
