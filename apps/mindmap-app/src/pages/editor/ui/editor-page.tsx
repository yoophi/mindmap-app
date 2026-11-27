import { ArrowDownRight, FilePlus, FolderOpen, GitBranch, ListTree, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect } from "react";
import { MindMapCanvas } from "../../../entities/mind-map";
import { useEditor } from "../../../features/edit-map";
import "./editor-page.css";

export function EditorPage() {
  const editor = useEditor();
  const root = editor.layout.nodes[0];
  const fileName = editor.path?.split(/[/\\]/).pop();

  function onKeyboard(event: KeyboardEvent) {
    if (event.isComposing || (event.target instanceof HTMLElement && event.target.closest("input, textarea, [contenteditable]"))) return;
    const { key, metaKey, ctrlKey, altKey, shiftKey } = event;
    if (editor.pending) return;

    if (metaKey || ctrlKey) {
      switch (key.toLowerCase()) {
        case "n": event.preventDefault(); editor.create(); break;
        case "o": event.preventDefault(); editor.open(); break;
        case "s": event.preventDefault(); editor.save(); break;
      }
    } else if (key === "Enter" && (altKey || shiftKey)) {
      event.preventDefault();
      editor.insert(!altKey);
    } else if (key === "F2") {
      event.preventDefault();
      editor.edit(editor.selected.id);
    } else if (key === "Delete" || key === "Backspace") {
      event.preventDefault();
      editor.remove();
    }
  }

  useEffect(() => {
    window.addEventListener("keydown", onKeyboard);
    return () => window.removeEventListener("keydown", onKeyboard);
  });

  return (
    <main className="editor">
      <header className="editor-chrome">
        <div className="editor-identity">
          <div className="editor-app-icon"><GitBranch size={19} strokeWidth={1.8} /></div>
          <span>Mindmap</span>
        </div>
        <div className="editor-file-actions" role="group" aria-label="Document actions">
          <button type="button" disabled={editor.pending} onClick={editor.create}><FilePlus size={17} /> New</button>
          <button type="button" disabled={editor.pending} onClick={editor.open}><FolderOpen size={18} /> Open</button>
          <button type="button" className="editor-save" disabled={editor.pending} onClick={editor.save}><Save size={16} /> Save</button>
        </div>
      </header>
      <div className="editor-document-bar">
        <div className="editor-document-title">
          <h1 title={root.title}>{root.title}</h1>
          <p role="status" title={fileName}>{editor.pending ? "Waiting for file selection…" : editor.dirty ? "Unsaved changes" : fileName ?? "Local document"}</p>
        </div>
        <div className="editor-node-actions" role="group" aria-label="Topic actions">
          <button type="button" disabled={!editor.canAddChild || editor.pending} onClick={() => editor.insert(false)} title="Add child (Option+Enter)"><Plus size={17} /> Child</button>
          <button type="button" disabled={!editor.canAddSibling || editor.pending} onClick={() => editor.insert(true)} title="Add sibling (Shift+Enter)"><ArrowDownRight size={16} /> Sibling</button>
          <span className="editor-action-divider" />
          <button type="button" className="editor-icon-button" disabled={editor.pending} onClick={() => editor.edit(editor.selected.id)} aria-label="Rename topic" title="Rename topic (F2)"><Pencil size={16} /></button>
          <button type="button" className="editor-icon-button editor-delete" disabled={editor.selected.parentId === null || editor.pending} onClick={editor.remove} aria-label="Delete topic" title="Delete topic"><Trash2 size={16} /></button>
        </div>
      </div>
      {editor.error && (
        <div className="editor-error" role="alert">
          <span>{editor.error}</span>
          <button type="button" aria-label="Dismiss error" onClick={editor.clearError}><X size={17} /></button>
        </div>
      )}
      <div className="editor-workspace">
        <aside className="editor-outline" aria-label="Document outline">
          <header><ListTree size={16} /><h2>Outline</h2><span>{editor.map.nodes.length}</span></header>
          <ul>
            {editor.layout.nodes.map((node) => (
              <li key={node.id} style={{ paddingLeft: Math.min(node.depth, 7) * 13 }}>
                <button type="button" disabled={editor.pending} aria-pressed={node.id === editor.selected.id} data-branch={node.branch} title={node.title} onClick={() => editor.select(node.id)} onDoubleClick={() => editor.edit(node.id)}>
                  <span className="editor-outline-dot" />
                  <span className="editor-outline-label">{node.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <MindMapCanvas
          key={editor.map.rootId}
          layout={editor.layout}
          selectedId={editor.selected.id}
          editingId={editor.editingId}
          disabled={editor.pending}
          onSelect={editor.select}
          onEdit={editor.edit}
          onRename={editor.rename}
          onCancelEdit={editor.cancelEdit}
          onMove={editor.move}
        />
      </div>
    </main>
  );
}
