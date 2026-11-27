import { Maximize, Minus, Plus } from "lucide-react";
import { type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import type { BranchSide } from "../model/document";
import { canMoveTo, nodeHeight, nodeWidth, type MapLayout, type PlacedNode } from "../model/layout";
import "./mind-map-canvas.css";

type View = { x: number; y: number; scale: number };
type Size = { width: number; height: number };
type Gesture =
  | { kind: "pan"; pointer: number; x: number; y: number; view: View }
  | { kind: "node"; pointer: number; x: number; y: number; node: PlacedNode; moved: boolean };
type DropTarget =
  | { kind: "parent" | "invalid"; id: string; side: BranchSide }
  | { kind: "sibling"; parentId: string; side: BranchSide; beforeId: string | null; x: number; y: number };

type Props = {
  layout: MapLayout;
  selectedId: string;
  editingId: string | null;
  disabled?: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onCancelEdit: () => void;
  onMove: (id: string, parentId: string, side: BranchSide, beforeId: string | null) => void;
};

function fit(size: Size, layout: MapLayout): View {
  const padding = Math.min(112, size.width / 4, size.height / 4);
  const scale = Math.min(1, (size.width - padding) / layout.width, (size.height - padding) / layout.height);
  return {
    scale,
    x: (size.width - layout.width * scale) / 2 - layout.minX * scale,
    y: (size.height - layout.height * scale) / 2 - layout.minY * scale,
  };
}

export function MindMapCanvas({ layout, selectedId, editingId, disabled, onSelect, onEdit, onRename, onCancelEdit, onMove }: Props) {
  const area = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const ignorePointerClick = useRef(false);
  const [size, setSize] = useState<Size>({ width: 800, height: 560 });
  const [customView, setView] = useState<View | null>(null);
  const [panning, setPanning] = useState(false);
  const [dragging, setDragging] = useState<{ title: string; id: string; x: number; y: number; target: DropTarget } | null>(null);
  const view = customView ?? fit(size, layout);

  useEffect(() => {
    if (!area.current) return;
    const observer = new ResizeObserver(([{ contentRect }]) => {
      if (contentRect.width > 0 && contentRect.height > 0) {
        setSize({ width: contentRect.width, height: contentRect.height });
      }
    });
    observer.observe(area.current);
    return () => observer.disconnect();
  }, []);

  const zoomAt = useCallback((factor: number, x: number, y: number) => {
    setView((custom) => {
      const current = custom ?? fit(size, layout);
      const scale = Math.min(2, Math.max(Math.min(0.05, current.scale), current.scale * factor));
      return {
        scale,
        x: x - (x - current.x) * scale / current.scale,
        y: y - (y - current.y) * scale / current.scale,
      };
    });
  }, [size, layout]);

  useEffect(() => {
    const element = area.current;
    if (!element) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const multiplier = event.deltaMode === 1 ? 16 : 1;
      if (event.ctrlKey || event.metaKey) {
        const bounds = element!.getBoundingClientRect();
        zoomAt(Math.exp(-event.deltaY * multiplier * 0.006), event.clientX - bounds.left, event.clientY - bounds.top);
      } else {
        setView((custom) => {
          const current = custom ?? fit(size, layout);
          return {
            ...current,
            x: current.x - event.deltaX * multiplier,
            y: current.y - event.deltaY * multiplier,
          };
        });
      }
    }
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [size, layout, zoomAt]);

  useEffect(() => {
    const node = layout.byId.get(selectedId);
    if (!node) return;
    setView((current) => {
      if (!current) return null;
      const margin = 28;
      const left = node.x * current.scale + current.x;
      const top = node.y * current.scale + current.y;
      const maxLeft = Math.max(margin, size.width - nodeWidth * current.scale - margin);
      const maxTop = Math.max(margin, size.height - nodeHeight * current.scale - margin);
      const dx = Math.min(maxLeft, Math.max(margin, left)) - left;
      const dy = Math.min(maxTop, Math.max(margin, top)) - top;
      return dx !== 0 || dy !== 0 ? { ...current, x: current.x + dx, y: current.y + dy } : current;
    });
  }, [selectedId, size, layout]);

  function findDrop(node: PlacedNode, x: number, y: number): DropTarget {
    const mapX = (x - view.x) / view.scale;
    const mapY = (y - view.y) / view.scale;
    const side = mapX < nodeWidth / 2 ? "left" : "right";
    const target = layout.nodes.find((candidate) =>
      candidate.id !== node.id &&
      mapX >= candidate.x && mapX <= candidate.x + nodeWidth &&
      mapY >= candidate.y + 7 && mapY <= candidate.y + nodeHeight - 7,
    );
    if (target) {
      return { kind: canMoveTo(layout, node, target) ? "parent" : "invalid", id: target.id, side };
    }

    const parentId = node.parentId!;
    const rootBranch = parentId === layout.nodes[0].id;
    const direction = rootBranch ? side : node.direction;
    const siblings = layout.nodes.filter((candidate) =>
      candidate.id !== node.id && candidate.parentId === parentId && candidate.direction === direction,
    );
    const nextIndex = siblings.findIndex((candidate) => mapY < candidate.y + nodeHeight / 2);
    const before = siblings[nextIndex];
    const after = siblings[nextIndex === -1 ? siblings.length - 1 : nextIndex - 1];
    return {
      kind: "sibling",
      parentId,
      side: direction,
      beforeId: before?.id ?? null,
      x: (before ?? after)?.x ?? (direction === node.direction ? node.x : -node.x),
      y: before && after ? (before.y + after.y + nodeHeight) / 2
        : before ? before.y - 10
        : after ? after.y + nodeHeight + 10
        : node.y + nodeHeight / 2,
    };
  }

  function startGesture(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || gesture.current) return;
    ignorePointerClick.current = false;
    const element = event.target instanceof Element ? event.target : null;
    const button = element?.closest<HTMLButtonElement>("button[data-node-id]");
    if (button) {
      const node = layout.byId.get(button.dataset.nodeId ?? "");
      if (disabled || !node || node.parentId === null) return;
      gesture.current = { kind: "node", pointer: event.pointerId, x: event.clientX, y: event.clientY, node, moved: false };
      button.setPointerCapture(event.pointerId);
    } else if (!element?.closest("button, input, form")) {
      gesture.current = { kind: "pan", pointer: event.pointerId, x: event.clientX, y: event.clientY, view };
      event.currentTarget.setPointerCapture(event.pointerId);
      setPanning(true);
    }
  }

  function moveGesture(event: PointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (current?.pointer !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (current.kind === "pan") {
      setView({ ...current.view, x: current.view.x + dx, y: current.view.y + dy });
    } else {
      if (!current.moved && Math.hypot(dx, dy) < 5) return;
      current.moved = true;
      ignorePointerClick.current = true;
      const bounds = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      setDragging({ title: current.node.title, id: current.node.id, x, y, target: findDrop(current.node, x, y) });
    }
  }

  function stopGesture(event: PointerEvent<HTMLDivElement>, commit: boolean) {
    const current = gesture.current;
    if (current?.pointer !== event.pointerId) return;
    gesture.current = null;
    setPanning(false);
    setDragging(null);
    if (!commit || current.kind !== "node" || !current.moved) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (x < 0 || y < 0 || x > bounds.width || y > bounds.height) return;
    const target = findDrop(current.node, x, y);
    if (target.kind === "invalid") return;
    onSelect(current.node.id);
    if (target.kind === "parent") {
      onMove(current.node.id, target.id, target.side, null);
    } else if (target.kind === "sibling") {
      onMove(current.node.id, target.parentId, target.side, target.beforeId);
    }
  }

  return (
    <section className="mindmap-canvas" aria-label="Mind map canvas">
      <div
        className="mindmap-surface"
        ref={area}
        data-panning={panning || dragging !== null}
        onPointerDown={startGesture}
        onPointerMove={moveGesture}
        onPointerUp={(event) => stopGesture(event, true)}
        onPointerCancel={(event) => stopGesture(event, false)}
        onLostPointerCapture={(event) => stopGesture(event, false)}
      >
        <div className="mindmap-stage" style={{ width: layout.width, height: layout.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
          <svg className="mindmap-edges" aria-hidden="true" width={layout.width} height={layout.height}>
            {layout.nodes.map((node) => {
              const parent = node.parentId === null ? undefined : layout.byId.get(node.parentId);
              if (!parent) return null;
              const left = node.direction === "left";
              const x1 = parent.x + (left ? 0 : nodeWidth);
              const x2 = node.x + (left ? nodeWidth : 0);
              const y1 = parent.y + nodeHeight / 2;
              const y2 = node.y + nodeHeight / 2;
              const mid = (x1 + x2) / 2;
              return <path key={node.id} data-branch={node.branch} d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`} />;
            })}
          </svg>
          {layout.nodes.map((node) => {
            const position = { left: node.x, top: node.y, width: nodeWidth, height: nodeHeight };
            const appearance = {
              className: "mindmap-node",
              "data-root": node.depth === 0,
              "data-branch": node.branch,
              "data-selected": selectedId === node.id,
              "data-dragged": dragging?.id === node.id,
              "data-drop": dragging?.target.kind !== "sibling" && dragging?.target.id === node.id
                ? dragging.target.kind : undefined,
              style: position,
            };
            if (editingId === node.id) {
              return <form key={node.id} {...appearance} onSubmit={(event) => {
                event.preventDefault();
                onRename(node.id, String(new FormData(event.currentTarget).get("title") ?? ""));
              }}>
                <input
                  autoFocus
                  aria-label="Topic title"
                  name="title"
                  defaultValue={node.title}
                  onFocus={(event) => event.currentTarget.select()}
                  onBlur={(event) => onRename(node.id, event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      onCancelEdit();
                    }
                  }}
                />
              </form>;
            }
            return (
              <button
                key={node.id}
                type="button"
                {...appearance}
                data-node-id={node.id}
                aria-label={node.title}
                aria-pressed={selectedId === node.id}
                disabled={disabled}
                title={node.title}
                onClick={(event) => {
                  if (event.detail === 0 || !ignorePointerClick.current) onSelect(node.id);
                }}
                onDoubleClick={() => {
                  if (!ignorePointerClick.current) onEdit(node.id);
                }}
              >
                <span className="mindmap-node-dot" />
                <span className="mindmap-node-title">{node.title}</span>
              </button>
            );
          })}
          {dragging?.target.kind === "sibling" && (
            <div className="mindmap-insertion" style={{ left: dragging.target.x, top: dragging.target.y, width: nodeWidth }} />
          )}
        </div>
        {dragging && (
          <div aria-hidden="true" className="mindmap-drag-preview" data-invalid={dragging.target.kind === "invalid"} style={{ left: dragging.x + 13, top: dragging.y + 13 }}>
            {dragging.title}
          </div>
        )}
      </div>
      <p className="mindmap-drag-tip">Drag between topics to reorder or switch sides. Drop onto a topic to move under it.</p>
      <div className="mindmap-zoom" role="group" aria-label="Canvas zoom">
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => zoomAt(0.8, size.width / 2, size.height / 2)}><Minus size={16} /></button>
        <output aria-label="Zoom level">{Math.max(1, Math.round(view.scale * 100))}%</output>
        <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => zoomAt(1.25, size.width / 2, size.height / 2)}><Plus size={16} /></button>
        <button type="button" className="mindmap-fit" aria-label="Fit map" title="Fit map" onClick={() => setView(null)}><Maximize size={15} /></button>
      </div>
    </section>
  );
}
