export type BranchSide = "left" | "right";

export type MapNode = {
  id: string;
  parentId: string | null;
  title: string;
  side?: BranchSide;
};

export type MindMap = {
  version: 1;
  rootId: string;
  nodes: MapNode[];
};

export const maxNodes = 1_000;
export const maxDepth = 64;
export const maxTitleLength = 160;

export function newMap(): MindMap {
  const id = crypto.randomUUID();
  return { version: 1, rootId: id, nodes: [{ id, parentId: null, title: "Untitled map" }] };
}

export function demoMap(): MindMap {
  return {
    version: 1,
    rootId: "launch",
    nodes: [
      { id: "launch", parentId: null, title: "Product launch" },
      { id: "strategy", parentId: "launch", title: "Strategy" },
      { id: "audience", parentId: "strategy", title: "Target audience" },
      { id: "success", parentId: "strategy", title: "Success metrics" },
      { id: "creative", parentId: "launch", title: "Creative", side: "left" },
      { id: "story", parentId: "creative", title: "Launch story" },
      { id: "delivery", parentId: "launch", title: "Delivery" },
      { id: "timeline", parentId: "delivery", title: "Timeline" },
      { id: "channels", parentId: "delivery", title: "Channels" },
    ],
  };
}

export function indexNodes(map: MindMap) {
  const byId = new Map<string, MapNode>();
  const children = new Map<string, MapNode[]>();

  for (const node of map.nodes) {
    byId.set(node.id, node);
    if (node.parentId === null) continue;
    const siblings = children.get(node.parentId) ?? [];
    if (siblings.length === 0) children.set(node.parentId, siblings);
    siblings.push(node);
  }
  return { byId, children };
}
