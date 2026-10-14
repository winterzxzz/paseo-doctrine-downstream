import type { TopologyNode } from "@/panels/topology-model";

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

export const TOPOLOGY_NODE_WIDTH = 280;
/** Horizontal space between relationship depths (Supervisor → Lead → Peer). */
export const TOPOLOGY_DEPTH_GAP = 104;
/** Horizontal space between columns of a Peer grid or the unrelated-agent grid. */
export const TOPOLOGY_GRID_COLUMN_GAP = 24;
/** Vertical space between sibling cards or sibling subtrees. */
export const TOPOLOGY_ROW_GAP = 24;
/** Vertical space between disconnected relationship trees. */
export const TOPOLOGY_TREE_GAP = 56;
/** More leaf children than this wrap into a grid instead of one tall column. */
const LEAF_GRID_THRESHOLD = 4;
const LEAF_GRID_ROWS = 4;
const LEAF_GRID_MAX_COLUMNS = 3;
const DEPTH_STRIDE = TOPOLOGY_NODE_WIDTH + TOPOLOGY_DEPTH_GAP;
const GRID_STRIDE = TOPOLOGY_NODE_WIDTH + TOPOLOGY_GRID_COLUMN_GAP;

/**
 * Fixed row heights of the agent card. The card renders at exactly the height
 * this module computes (overflow clipped), and every row has a fixed height in
 * CSS, so the layout never relies on DOM measurement and cards cannot overlap.
 */
export const TOPOLOGY_CARD_METRICS = {
  padding: 12,
  rowGap: 8,
  head: 24,
  title: 38,
  chips: 22,
  line: 16,
  issuesHeader: 9 + 14,
  issueRow: 16,
  issueGap: 4,
  maxIssues: 2,
} as const;

export interface TopologyCardContent {
  hasProfile: boolean;
  hasAssignment: boolean;
  requiresAttention: boolean;
  childCount: number;
  issueCount: number;
}

export function topologyCardContentOf(node: TopologyNode, childCount: number): TopologyCardContent {
  return {
    hasProfile: node.launchProfile !== null,
    hasAssignment: Boolean(node.launchProfile?.peerSubrole || node.assignmentDisposition),
    requiresAttention: node.requiresAttention,
    childCount,
    issueCount: node.issueIds.length,
  };
}

export function estimateTopologyNodeHeight(content: TopologyCardContent): number {
  const m = TOPOLOGY_CARD_METRICS;
  const rows: number[] = [m.head, m.title, m.chips];
  if (content.hasProfile) rows.push(m.line);
  if (content.hasAssignment) rows.push(m.line);
  if (content.requiresAttention) rows.push(m.line);
  if (content.childCount > 0) rows.push(m.line);
  if (content.issueCount > 0) {
    const shown = Math.min(content.issueCount, m.maxIssues);
    const items = shown + (content.issueCount > m.maxIssues ? 1 : 0);
    rows.push(m.issuesHeader + items * (m.issueRow + m.issueGap));
  }
  const body = rows.reduce((sum, row) => sum + row, 0) + m.rowGap * (rows.length - 1);
  // Card border (1px top and bottom) plus slack.
  return m.padding * 2 + body + 4;
}

function childCountsOf(
  nodes: readonly TopologyNode[],
  edges: readonly TopologyLayoutEdge[],
): Map<string, number> {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const counts = new Map<string, number>();
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
  }
  return counts;
}

function heightsOf(
  nodes: readonly TopologyNode[],
  edges: readonly TopologyLayoutEdge[],
): Map<string, number> {
  const childCounts = childCountsOf(nodes, edges);
  return new Map(
    nodes.map((node) => [
      node.id,
      estimateTopologyNodeHeight(topologyCardContentOf(node, childCounts.get(node.id) ?? 0)),
    ]),
  );
}

interface LeafGrid {
  columns: number;
  rowHeights: number[];
}

/**
 * Lay each relationship tree out from left to right: X is relationship depth,
 * and every subtree owns a vertical band that no other subtree enters. A parent
 * is centered on its children's band. Many leaf children (a Lead's Peers) wrap
 * into a grid of up to three columns so the tree stays readable. Bands are
 * computed from the fixed card heights, so cards never overlap.
 */
export function layoutProjectTopologyXFirst(
  nodes: readonly TopologyNode[],
  edges: readonly TopologyLayoutEdge[],
): Map<string, TopologyBox> {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const nodeOrder = new Map(nodes.map((node, index) => [node.id, index]));
  const heights = heightsOf(nodes, edges);
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

  const heightOf = (nodeId: string) => heights.get(nodeId) ?? 0;
  const leafGridOf = (nodeId: string): LeafGrid | null => {
    const children = treeChildren.get(nodeId) ?? [];
    if (children.length <= LEAF_GRID_THRESHOLD) return null;
    if (children.some((childId) => (treeChildren.get(childId) ?? []).length > 0)) return null;
    const columns = Math.min(LEAF_GRID_MAX_COLUMNS, Math.ceil(children.length / LEAF_GRID_ROWS));
    const rowHeights: number[] = [];
    children.forEach((childId, index) => {
      const row = Math.floor(index / columns);
      rowHeights[row] = Math.max(rowHeights[row] ?? 0, heightOf(childId));
    });
    return { columns, rowHeights };
  };

  const bandCache = new Map<string, number>();
  const childrenBand = (nodeId: string): number => {
    const children = treeChildren.get(nodeId) ?? [];
    if (children.length === 0) return 0;
    const grid = leafGridOf(nodeId);
    const bands = grid ? grid.rowHeights : children.map(bandOf);
    return bands.reduce((sum, band) => sum + band, 0) + TOPOLOGY_ROW_GAP * (bands.length - 1);
  };
  const bandOf = (nodeId: string): number => {
    const cached = bandCache.get(nodeId);
    if (cached !== undefined) return cached;
    const band = Math.max(heightOf(nodeId), childrenBand(nodeId));
    bandCache.set(nodeId, band);
    return band;
  };

  const boxes = new Map<string, TopologyBox>();
  const place = (nodeId: string, depth: number, top: number) => {
    const band = bandOf(nodeId);
    const x = depth * DEPTH_STRIDE;
    boxes.set(nodeId, {
      x,
      y: top + (band - heightOf(nodeId)) / 2,
      width: TOPOLOGY_NODE_WIDTH,
      height: heightOf(nodeId),
    });
    const children = treeChildren.get(nodeId) ?? [];
    if (children.length === 0) return;
    const childTop = top + (band - childrenBand(nodeId)) / 2;
    const grid = leafGridOf(nodeId);
    if (grid) {
      let rowTop = childTop;
      grid.rowHeights.forEach((rowHeight, row) => {
        for (let column = 0; column < grid.columns; column += 1) {
          const childId = children[row * grid.columns + column];
          if (!childId) break;
          boxes.set(childId, {
            x: x + DEPTH_STRIDE + column * GRID_STRIDE,
            y: rowTop,
            width: TOPOLOGY_NODE_WIDTH,
            height: heightOf(childId),
          });
        }
        rowTop += rowHeight + TOPOLOGY_ROW_GAP;
      });
      return;
    }
    let cursor = childTop;
    for (const childId of children) {
      place(childId, depth + 1, cursor);
      cursor += bandOf(childId) + TOPOLOGY_ROW_GAP;
    }
  };

  let top = 0;
  for (const rootId of roots) {
    place(rootId, 0, top);
    const hasRelationships = (treeChildren.get(rootId) ?? []).length > 0;
    top += bandOf(rootId) + (hasRelationships ? TOPOLOGY_TREE_GAP : TOPOLOGY_ROW_GAP);
  }
  return boxes;
}

/**
 * Layout for a page that stacks many graphs: relationship trees keep the
 * left-to-right layout, while agents with no relationship at all fill a grid
 * underneath instead of each taking a full-width lane.
 */
export function layoutProjectTopologyPacked(
  nodes: readonly TopologyNode[],
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
  const heights = heightsOf(unrelated, []);
  const safeColumns = Math.max(1, Math.floor(columns));
  let rowTop = gridTop;
  for (let start = 0; start < unrelated.length; start += safeColumns) {
    const row = unrelated.slice(start, start + safeColumns);
    let rowHeight = 0;
    row.forEach((node, column) => {
      const height = heights.get(node.id) ?? 0;
      rowHeight = Math.max(rowHeight, height);
      boxes.set(node.id, {
        x: column * GRID_STRIDE,
        y: rowTop,
        width: TOPOLOGY_NODE_WIDTH,
        height,
      });
    });
    rowTop += rowHeight + TOPOLOGY_ROW_GAP;
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
