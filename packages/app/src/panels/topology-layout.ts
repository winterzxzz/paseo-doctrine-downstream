interface TopologyLayoutNode {
  id: string;
  /** Card height at zoom 1; defaults to TOPOLOGY_NODE_HEIGHT. */
  height?: number;
}

interface TopologyLayoutEdge {
  source: string;
  target: string;
}

/** Top-left corner and size of one agent card, in canvas pixels at zoom 1. */
export interface TopologyBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const TOPOLOGY_NODE_WIDTH = 264;
/**
 * The tallest card. Cards are sized from their content before layout (see
 * `topologyCardHeight`) — every row has a fixed height in CSS — so the layout
 * never relies on DOM measurement. A node without a height gets this one.
 */
export const TOPOLOGY_NODE_HEIGHT = 196;
// Card rows, in CSS pixels (see .tp-node in topology-graph.web.tsx).
const CARD_PADDING = 13 + 12;
const CARD_HEAD = 22;
const CARD_TITLE_LINE = 19;
const CARD_TITLE_GAP = 10;
const CARD_META = 4 + 16;
const CARD_TASK = 10 + 18;
const CARD_DETAIL = 4 + 18;
// The footer takes the leftover space (margin-top: auto); 6px is the gap it gets here.
const CARD_FOOT = 6 + 28;
/** A title longer than this wraps to a second line at the card's width. */
export const TOPOLOGY_TITLE_ONE_LINE_CHARS = 30;

export function topologyTitleLines(title: string): 1 | 2 {
  return title.length > TOPOLOGY_TITLE_ONE_LINE_CHARS ? 2 : 1;
}

/** Height of a card that shows `titleLines` of title and, optionally, a detail row. */
export function topologyCardHeight(card: { titleLines: 1 | 2; hasDetail: boolean }): number {
  return (
    CARD_PADDING +
    CARD_HEAD +
    CARD_TITLE_GAP +
    card.titleLines * CARD_TITLE_LINE +
    CARD_META +
    CARD_TASK +
    (card.hasDetail ? CARD_DETAIL : 0) +
    CARD_FOOT
  );
}

/** Horizontal space between relationship depths (Supervisor → Lead → Peer). */
export const TOPOLOGY_DEPTH_GAP = 88;
/** Horizontal space between columns of a Peer grid or the unrelated-agent grid. */
export const TOPOLOGY_GRID_COLUMN_GAP = 20;
/** Vertical space between sibling leaf cards. */
export const TOPOLOGY_ROW_GAP = 16;
/** Vertical space around a sibling that brings its own children, so groups read as groups. */
export const TOPOLOGY_SUBTREE_GAP = 32;
/** Vertical space between disconnected relationship trees. */
export const TOPOLOGY_TREE_GAP = 48;
/** More leaf children than this wrap into a grid instead of one tall column. */
const LEAF_GRID_THRESHOLD = 4;
const LEAF_GRID_ROWS = 4;
const LEAF_GRID_MAX_COLUMNS = 3;
const DEPTH_STRIDE = TOPOLOGY_NODE_WIDTH + TOPOLOGY_DEPTH_GAP;
const GRID_STRIDE = TOPOLOGY_NODE_WIDTH + TOPOLOGY_GRID_COLUMN_GAP;

interface LeafGrid {
  columns: number;
  rows: number;
  rowHeight: number;
}

/**
 * Lay each relationship tree out from left to right: X is relationship depth,
 * and every subtree owns a vertical band that no other subtree enters. A parent
 * is centered on its children's band. Many leaf children (a Lead's Peers) wrap
 * into a grid of up to three columns so the tree stays readable. Bands are
 * computed from the fixed card heights, so cards never overlap.
 */
export function layoutProjectTopologyXFirst(
  nodes: readonly TopologyLayoutNode[],
  edges: readonly TopologyLayoutEdge[],
): Map<string, TopologyBox> {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const nodeOrder = new Map(nodes.map((node, index) => [node.id, index]));
  const heights = new Map(nodes.map((node) => [node.id, node.height ?? TOPOLOGY_NODE_HEIGHT]));
  const heightOf = (nodeId: string) => heights.get(nodeId) ?? TOPOLOGY_NODE_HEIGHT;
  const childrenByParent = new Map<string, string[]>();
  const childIds = new Set<string>();

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    const children = childrenByParent.get(edge.source) ?? [];
    children.push(edge.target);
    childrenByParent.set(edge.source, children);
    childIds.add(edge.target);
  }
  for (const children of childrenByParent.values()) {
    children.sort((left, right) => (nodeOrder.get(left) ?? 0) - (nodeOrder.get(right) ?? 0));
  }

  // Claim each node for exactly one tree parent (first visit wins), so a cycle
  // or a node with two parents is still placed exactly once.
  const treeChildren = new Map<string, string[]>();
  const claimed = new Set<string>();
  const claim = (nodeId: string) => {
    claimed.add(nodeId);
    const owned: string[] = [];
    for (const childId of childrenByParent.get(nodeId) ?? []) {
      if (claimed.has(childId)) continue;
      claimed.add(childId);
      owned.push(childId);
    }
    treeChildren.set(nodeId, owned);
    for (const childId of owned) claim(childId);
  };
  const roots: string[] = [];
  for (const node of nodes) {
    if (childIds.has(node.id) || claimed.has(node.id)) continue;
    roots.push(node.id);
    claim(node.id);
  }
  // Cycles are invalid topology, but keep every node visible while the
  // warning/receipt layer reports the malformed relationship.
  for (const node of nodes) {
    if (claimed.has(node.id)) continue;
    roots.push(node.id);
    claim(node.id);
  }

  const hasChildren = (nodeId: string) => (treeChildren.get(nodeId) ?? []).length > 0;
  const gapBetween = (previousId: string, nextId: string) =>
    hasChildren(previousId) || hasChildren(nextId) ? TOPOLOGY_SUBTREE_GAP : TOPOLOGY_ROW_GAP;
  const leafGridOf = (nodeId: string): LeafGrid | null => {
    const children = treeChildren.get(nodeId) ?? [];
    if (children.length <= LEAF_GRID_THRESHOLD) return null;
    if (children.some(hasChildren)) return null;
    const columns = Math.min(LEAF_GRID_MAX_COLUMNS, Math.ceil(children.length / LEAF_GRID_ROWS));
    // Grid rows share one height (the tallest child) so columns stay aligned.
    const rowHeight = Math.max(...children.map(heightOf));
    return { columns, rows: Math.ceil(children.length / columns), rowHeight };
  };

  const bandCache = new Map<string, number>();
  const childrenBand = (nodeId: string): number => {
    const children = treeChildren.get(nodeId) ?? [];
    if (children.length === 0) return 0;
    const grid = leafGridOf(nodeId);
    if (grid) return grid.rows * grid.rowHeight + (grid.rows - 1) * TOPOLOGY_ROW_GAP;
    return children.reduce(
      (sum, childId, index) =>
        sum + bandOf(childId) + (index > 0 ? gapBetween(children[index - 1], childId) : 0),
      0,
    );
  };
  const bandOf = (nodeId: string): number => {
    const cached = bandCache.get(nodeId);
    if (cached !== undefined) return cached;
    const band = Math.max(heightOf(nodeId), childrenBand(nodeId));
    bandCache.set(nodeId, band);
    return band;
  };

  const boxes = new Map<string, TopologyBox>();
  const setBox = (nodeId: string, x: number, y: number) =>
    boxes.set(nodeId, { x, y, width: TOPOLOGY_NODE_WIDTH, height: heightOf(nodeId) });
  const place = (nodeId: string, depth: number, top: number) => {
    const band = bandOf(nodeId);
    const x = depth * DEPTH_STRIDE;
    setBox(nodeId, x, top + (band - heightOf(nodeId)) / 2);
    const children = treeChildren.get(nodeId) ?? [];
    if (children.length === 0) return;
    const childTop = top + (band - childrenBand(nodeId)) / 2;
    const grid = leafGridOf(nodeId);
    if (grid) {
      children.forEach((childId, index) => {
        const row = Math.floor(index / grid.columns);
        const column = index % grid.columns;
        setBox(
          childId,
          x + DEPTH_STRIDE + column * GRID_STRIDE,
          childTop + row * (grid.rowHeight + TOPOLOGY_ROW_GAP),
        );
      });
      return;
    }
    let cursor = childTop;
    children.forEach((childId, index) => {
      if (index > 0) cursor += gapBetween(children[index - 1], childId);
      place(childId, depth + 1, cursor);
      cursor += bandOf(childId);
    });
  };

  let top = 0;
  for (const rootId of roots) {
    place(rootId, 0, top);
    top += bandOf(rootId) + (hasChildren(rootId) ? TOPOLOGY_TREE_GAP : TOPOLOGY_ROW_GAP);
  }
  return boxes;
}

/**
 * Layout for a page that stacks many graphs: relationship trees keep the
 * left-to-right layout, while agents with no relationship at all fill a grid
 * underneath instead of each taking a full-width lane.
 */
export function layoutProjectTopologyPacked(
  nodes: readonly TopologyLayoutNode[],
  edges: readonly TopologyLayoutEdge[],
  columns: number,
): Map<string, TopologyBox> {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const related = new Set<string>();
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    related.add(edge.source);
    related.add(edge.target);
  }
  const boxes = layoutProjectTopologyXFirst(
    nodes.filter((node) => related.has(node.id)),
    edges,
  );
  let gridTop = 0;
  for (const box of boxes.values()) {
    gridTop = Math.max(gridTop, box.y + box.height + TOPOLOGY_TREE_GAP);
  }
  const unrelated = nodes.filter((node) => !related.has(node.id));
  const safeColumns = Math.max(1, Math.floor(columns));
  let rowTop = gridTop;
  for (let start = 0; start < unrelated.length; start += safeColumns) {
    const row = unrelated.slice(start, start + safeColumns);
    row.forEach((node, column) => {
      boxes.set(node.id, {
        x: column * GRID_STRIDE,
        y: rowTop,
        width: TOPOLOGY_NODE_WIDTH,
        height: node.height ?? TOPOLOGY_NODE_HEIGHT,
      });
    });
    rowTop +=
      Math.max(...row.map((node) => node.height ?? TOPOLOGY_NODE_HEIGHT)) + TOPOLOGY_ROW_GAP;
  }
  return boxes;
}

/** Canvas pan (screen pixels) and zoom, as React Flow reports it. */
export interface TopologyViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface TopologySize {
  width: number;
  height: number;
}

/** Pointer jitter during a card click pans a few pixels; it is not a deliberate move. */
const DELIBERATE_PAN_PX = 4;
const DELIBERATE_ZOOM_DELTA = 0.001;

export function isDeliberateViewportChange(from: TopologyViewport, to: TopologyViewport): boolean {
  return (
    Math.abs(to.zoom - from.zoom) > DELIBERATE_ZOOM_DELTA ||
    Math.hypot(to.x - from.x, to.y - from.y) > DELIBERATE_PAN_PX
  );
}

/** Keep the canvas point that sat at the old container's center at the new center. */
export function recenterTopologyViewport(
  viewport: TopologyViewport,
  from: TopologySize,
  to: TopologySize,
): TopologyViewport {
  return {
    x: viewport.x + (to.width - from.width) / 2,
    y: viewport.y + (to.height - from.height) / 2,
    zoom: viewport.zoom,
  };
}

/** Whether any card overlaps the visible container area under `viewport`. */
export function topologyViewportShowsAnyBox(
  boxes: Iterable<TopologyBox>,
  viewport: TopologyViewport,
  size: TopologySize,
): boolean {
  for (const box of boxes) {
    const left = box.x * viewport.zoom + viewport.x;
    const top = box.y * viewport.zoom + viewport.y;
    const right = left + box.width * viewport.zoom;
    const bottom = top + box.height * viewport.zoom;
    if (right > 0 && bottom > 0 && left < size.width && top < size.height) return true;
  }
  return false;
}
