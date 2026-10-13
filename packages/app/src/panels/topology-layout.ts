import type { TopologyNode } from "@/panels/topology-model";

interface TopologyLayoutEdge {
  source: string;
  target: string;
}

export interface TopologyPosition {
  x: number;
  y: number;
}

const HORIZONTAL_GAP = 360;
const VERTICAL_LANE_GAP = 235;
const DISCONNECTED_TREE_GAP_LANES = 1;

/**
 * Lay each exact relationship tree out from left to right. X represents
 * relationship depth, while sibling branches receive separate Y lanes. A
 * parent is centered over its visible children so an edge can never imply that
 * one sibling spawned the next. Disconnected trees get a blank lane between
 * them.
 */
export function layoutProjectTopologyXFirst(
  nodes: readonly TopologyNode[],
  edges: readonly TopologyLayoutEdge[],
): Map<string, TopologyPosition> {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const nodeOrder = new Map(nodes.map((node, index) => [node.id, index]));
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

  const positions = new Map<string, TopologyPosition>();
  const placed = new Set<string>();
  let nextLeafLane = 0;

  const placeTree = (rootId: string) => {
    const visit = (
      nodeId: string,
      depth: number,
    ): { firstLane: number; lastLane: number } | null => {
      if (placed.has(nodeId)) return null;
      placed.add(nodeId);
      const childRanges = (childrenByParent.get(nodeId) ?? []).flatMap((childId) => {
        const range = visit(childId, depth + 1);
        return range ? [range] : [];
      });
      if (childRanges.length === 0) {
        const lane = nextLeafLane;
        nextLeafLane += 1;
        positions.set(nodeId, { x: depth * HORIZONTAL_GAP, y: lane * VERTICAL_LANE_GAP });
        return { firstLane: lane, lastLane: lane };
      }
      const firstLane = childRanges[0].firstLane;
      const lastLane = childRanges.at(-1)?.lastLane ?? firstLane;
      positions.set(nodeId, {
        x: depth * HORIZONTAL_GAP,
        y: ((firstLane + lastLane) / 2) * VERTICAL_LANE_GAP,
      });
      return { firstLane, lastLane };
    };
    const range = visit(rootId, 0);
    if (range) nextLeafLane += DISCONNECTED_TREE_GAP_LANES;
  };

  for (const node of nodes) {
    if (!childIds.has(node.id)) placeTree(node.id);
  }
  // Cycles are invalid topology, but keep every node visible in a deterministic
  // lane while the warning/receipt layer reports the malformed relationship.
  for (const node of nodes) placeTree(node.id);

  return positions;
}

const PACKED_COLUMN_GAP = 296;

/**
 * Layout for a page that stacks many graphs: relationship trees keep the
 * left-to-right layout, while agents with no relationship at all fill a grid
 * underneath instead of each taking a full-width lane.
 */
export function layoutProjectTopologyPacked(
  nodes: readonly TopologyNode[],
  edges: readonly TopologyLayoutEdge[],
  columns: number,
): Map<string, TopologyPosition> {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const related = new Set<string>();
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    related.add(edge.source);
    related.add(edge.target);
  }
  const positions = layoutProjectTopologyXFirst(
    nodes.filter((node) => related.has(node.id)),
    edges,
  );
  let gridTop = 0;
  for (const position of positions.values()) {
    gridTop = Math.max(gridTop, position.y + VERTICAL_LANE_GAP);
  }
  const safeColumns = Math.max(1, Math.floor(columns));
  let index = 0;
  for (const node of nodes) {
    if (related.has(node.id)) continue;
    positions.set(node.id, {
      x: (index % safeColumns) * PACKED_COLUMN_GAP,
      y: gridTop + Math.floor(index / safeColumns) * VERTICAL_LANE_GAP,
    });
    index += 1;
  }
  return positions;
}
