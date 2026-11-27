import { indexNodes, maxDepth, type BranchSide, type MapNode, type MindMap } from "./document";

export const nodeWidth = 174;
export const nodeHeight = 56;
const column = 218;
const row = 76;

export type PlacedNode = MapNode & {
  depth: number;
  subtreeDepth: number;
  branch: number;
  direction: BranchSide;
  x: number;
  y: number;
};

export type MapLayout = {
  nodes: PlacedNode[];
  byId: Map<string, PlacedNode>;
  minX: number;
  minY: number;
  width: number;
  height: number;
};

export function layoutMap(map: MindMap): MapLayout {
  const { byId, children } = indexNodes(map);
  const root: PlacedNode = { ...byId.get(map.rootId)!, depth: 0, subtreeDepth: 0, branch: 0, direction: "right", x: 0, y: 0 };
  const placed = [root];
  const rows = { left: 0, right: 0 };

  function place(node: MapNode, depth: number, branch: number, direction: BranchSide) {
    const item = { ...node, depth, subtreeDepth: 0, branch, direction, x: depth * column * (direction === "left" ? -1 : 1), y: 0 };
    placed.push(item);
    const childNodes = children.get(node.id) ?? [];
    if (childNodes.length === 0) {
      item.y = rows[direction]++ * row;
    } else {
      const positions = childNodes.map((child) => place(child, depth + 1, branch, direction));
      item.subtreeDepth = 1 + Math.max(...positions.map((child) => child.subtreeDepth));
      item.y = (positions[0].y + positions[positions.length - 1].y) / 2;
    }
    return item;
  }

  (children.get(root.id) ?? []).forEach((child, index) =>
    place(child, 1, index % 3, child.side ?? "right"),
  );

  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  for (const node of placed.slice(1)) {
    node.y -= (rows[node.direction] - 1) * row / 2;
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
  }

  return {
    nodes: placed,
    byId: new Map(placed.map((node) => [node.id, node])),
    minX,
    minY,
    width: maxX - minX + nodeWidth,
    height: maxY - minY + nodeHeight,
  };
}

export function canMoveTo(layout: MapLayout, node: PlacedNode, parent: PlacedNode) {
  if (node.parentId === null || parent.depth + 1 + node.subtreeDepth > maxDepth) return false;
  let current: PlacedNode | undefined = parent;
  while (current) {
    if (current.id === node.id) return false;
    current = current.parentId === null ? undefined : layout.byId.get(current.parentId);
  }
  return true;
}
