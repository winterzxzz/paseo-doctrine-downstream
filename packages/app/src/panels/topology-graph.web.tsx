import "@xyflow/react/dist/style.css";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Panel,
  Position,
  ReactFlow,
  getBezierPath,
  useNodesInitialized,
  useReactFlow,
  useStore,
  type ReactFlowState,
  type Viewport,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  Bot,
  CircleDashed,
  Compass,
  Cpu,
  Crown,
  GitFork,
  Network,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react-native";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ComponentType,
  type ReactNode,
} from "react";
import { withUnistyles } from "react-native-unistyles";
import type { BeadsIssue } from "@getpaseo/protocol/beads/rpc-schemas";
import {
  formatTopologyAssignment,
  type TopologyEdge,
  type TopologyNode,
  type TopologyRole,
} from "@/panels/topology-model";
import {
  TOPOLOGY_CARD_METRICS,
  TOPOLOGY_NODE_WIDTH,
  isDeliberateViewportChange,
  layoutProjectTopologyPacked,
  layoutProjectTopologyXFirst,
  recenterTopologyViewport,
  topologyViewportShowsAnyBox,
  type TopologySize,
} from "@/panels/topology-layout";
import type { Theme } from "@/styles/theme";

interface FlowNodeData extends Record<string, unknown> {
  topologyNode: TopologyNode;
  /** "Supervises 2 Leads · 1 running", or null for an agent with no children. */
  childSummary: string | null;
  issues: {
    id: string;
    title: string;
    status: BeadsIssue["status"] | null;
  }[];
}
type FlowNode = Node<FlowNodeData, "agent">;

interface FlowEdgeData extends Record<string, unknown> {
  kind: TopologyEdge["kind"];
  active: boolean;
  inferred: boolean;
  /** One label per parent: repeating "delegates" on every Peer edge is noise. */
  showLabel: boolean;
}
type FlowEdge = Edge<FlowEdgeData, "relationship">;

export const TOPOLOGY_ROLE_ORDER: TopologyRole[] = ["supervisor", "lead", "peer", "unbound"];
export const TOPOLOGY_ROLE_META: Record<
  TopologyRole,
  {
    label: string;
    plural: string;
    icon: ComponentType<{ color: string; size: number }>;
  }
> = {
  supervisor: { label: "Supervisor", plural: "Supervisors", icon: Crown },
  lead: { label: "Lead", plural: "Leads", icon: Compass },
  peer: { label: "Peer", plural: "Peers", icon: Bot },
  unbound: { label: "Unbound", plural: "Unbound", icon: CircleDashed },
};
export const TOPOLOGY_STATUS_LABELS: Record<TopologyNode["status"], string> = {
  initializing: "Starting",
  idle: "Idle",
  running: "Running",
  error: "Error",
  closed: "Closed",
};
const STATUS_ORDER: TopologyNode["status"][] = [
  "running",
  "initializing",
  "idle",
  "error",
  "closed",
];

// Role hues stay clear of the status dots (green/blue/amber/red) so a role
// stripe is never read as agent state.
const ROLE_COLORS = {
  dark: { supervisor: "#a78bfa", lead: "#22d3ee", peer: "#f472b6" },
  light: { supervisor: "#7c3aed", lead: "#0891b2", peer: "#db2777" },
} as const;

const TOPOLOGY_CSS = `
.tp-root { position: absolute; inset: 0; overflow: hidden; background: var(--tp-bg); font-family: inherit; }
.tp-theme { display: contents; }
.tp-root::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background:
    radial-gradient(60% 50% at 30% 40%, color-mix(in srgb, var(--tp-role-supervisor) 9%, transparent), transparent 70%),
    radial-gradient(50% 45% at 70% 60%, color-mix(in srgb, var(--tp-role-lead) 8%, transparent), transparent 70%);
}
.tp-root .react-flow { background: transparent; }
.tp-root .react-flow__handle { opacity: 0; width: 1px; height: 1px; min-width: 0; min-height: 0; border: 0; pointer-events: none; }
.tp-root .react-flow__node { cursor: pointer; }
.tp-root .react-flow__node:focus-visible { outline: none; }
.tp-root .react-flow__node:focus-visible .tp-node { box-shadow: 0 0 0 2px var(--tp-role); }
.tp-root .react-flow__attribution { display: none; }
.tp-root .react-flow__controls { border: 1px solid var(--tp-border); border-radius: 10px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,.25); }
.tp-root .react-flow__controls-button { background: var(--tp-surface); border-bottom: 1px solid var(--tp-border); color: var(--tp-fg-muted); fill: currentColor; width: 28px; height: 28px; }
.tp-root .react-flow__controls-button:last-child { border-bottom: 0; }
.tp-root .react-flow__controls-button:hover { background: var(--tp-surface-hover); color: var(--tp-fg); }

.tp-node {
  --tp-role: var(--tp-role-unbound);
  position: relative; width: 100%; height: 100%; box-sizing: border-box; padding: 12px 14px 12px 16px;
  display: flex; flex-direction: column; gap: 8px;
  border: 1px solid var(--tp-border); border-radius: 14px; overflow: hidden;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--tp-role) 10%, transparent), transparent 45%),
    var(--tp-surface);
  box-shadow: 0 1px 0 rgba(255,255,255,.03) inset, 0 10px 30px -12px rgba(0,0,0,.45);
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
  animation: tp-enter .35s cubic-bezier(.2,.8,.2,1) both;
}
[data-role="supervisor"] { --tp-role: var(--tp-role-supervisor); }
[data-role="lead"] { --tp-role: var(--tp-role-lead); }
[data-role="peer"] { --tp-role: var(--tp-role-peer); }
.tp-node::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--tp-role); }
.tp-node:hover, .tp-node[data-selected="true"] {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--tp-role) 65%, var(--tp-border));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--tp-role) 35%, transparent), 0 16px 36px -12px color-mix(in srgb, var(--tp-role) 40%, rgba(0,0,0,.6));
}
.tp-node[data-status="running"], .tp-node[data-status="initializing"] { animation: tp-enter .35s cubic-bezier(.2,.8,.2,1) both, tp-glow 2.4s ease-in-out .35s infinite; }
.tp-node[data-status="closed"] { opacity: .6; }

.tp-head { display: flex; align-items: center; gap: 8px; height: 24px; flex: none; }
.tp-short-id { color: var(--tp-fg-faint); font-size: 10.5px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.tp-role-icon { color: var(--tp-role); display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 8px; background: color-mix(in srgb, var(--tp-role) 18%, transparent); }
.tp-role-label { color: var(--tp-role); font-size: 10.5px; font-weight: 700; letter-spacing: .09em; }
.tp-head-spacer { flex: 1; }
.tp-status { display: flex; align-items: center; gap: 6px; padding: 2px 9px 2px 7px; border-radius: 999px; font-size: 11px; font-weight: 600; color: var(--tp-status); border: 1px solid color-mix(in srgb, var(--tp-status) 40%, transparent); background: color-mix(in srgb, var(--tp-status) 14%, transparent); }
.tp-dot { position: relative; width: 7px; height: 7px; border-radius: 50%; background: var(--tp-status); flex: none; }
[data-status="running"] > .tp-dot::after, [data-status="initializing"] > .tp-dot::after {
  content: ""; position: absolute; inset: -3px; border-radius: 50%; border: 1.5px solid var(--tp-status); animation: tp-ping 1.6s ease-out infinite;
}
[data-status="initializing"] { --tp-status: var(--tp-st-warning); }
[data-status="idle"] { --tp-status: var(--tp-st-success); }
[data-status="running"] { --tp-status: var(--tp-st-running); }
[data-status="error"] { --tp-status: var(--tp-st-danger); }
[data-status="closed"] { --tp-status: var(--tp-fg-faint); }

.tp-title { flex: none; height: 38px; color: var(--tp-fg); font-size: 13.5px; font-weight: 550; line-height: 19px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.tp-chips { display: flex; flex-wrap: nowrap; gap: 6px; height: 22px; flex: none; overflow: hidden; }
.tp-chip { display: inline-flex; align-items: center; gap: 5px; min-width: 0; flex: 0 1 auto; box-sizing: border-box; height: 22px; padding: 2px 7px; border-radius: 6px; border: 1px solid var(--tp-border); background: var(--tp-chip); color: var(--tp-fg-muted); font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.tp-chip > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-meta { flex: none; height: 16px; line-height: 16px; color: var(--tp-fg-muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-children { flex: none; display: flex; align-items: center; gap: 6px; height: 16px; line-height: 16px; color: var(--tp-fg-muted); font-size: 11px; white-space: nowrap; overflow: hidden; }
.tp-attention { flex: none; display: flex; align-items: center; gap: 5px; height: 16px; color: var(--tp-st-warning); font-size: 11px; font-weight: 600; }
.tp-issues { flex: none; display: flex; flex-direction: column; gap: 4px; padding-top: 8px; border-top: 1px dashed var(--tp-border); }
.tp-issues-label { height: 14px; line-height: 14px; color: var(--tp-fg-faint); font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
.tp-issue { display: flex; align-items: center; gap: 8px; height: 16px; font-size: 11px; }
.tp-issue-id { flex: none; color: var(--tp-fg-faint); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10.5px; }
.tp-issue-title { flex: 1; min-width: 0; color: var(--tp-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-issue-status { color: var(--tp-fg-muted); text-transform: capitalize; white-space: nowrap; }
.tp-issue-status[data-issue-status="blocked"] { color: var(--tp-st-danger); font-weight: 600; }
.tp-issue-status[data-issue-status="in_progress"] { color: var(--tp-st-running); }

.tp-edge { stroke: var(--tp-edge); stroke-width: 1.5; opacity: .55; fill: none; }
.tp-edge[data-active="true"] { opacity: .95; stroke-width: 2; stroke-dasharray: 6 6; animation: tp-flow 1s linear infinite; }
.tp-edge[data-inferred="true"] { stroke-dasharray: 5 5; }
.tp-edge-spark { fill: var(--tp-edge); filter: drop-shadow(0 0 4px var(--tp-edge)); }
.tp-edge-label { position: absolute; padding: 1px 8px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--tp-edge) 45%, var(--tp-border)); background: var(--tp-bg); color: var(--tp-edge); font-size: 10px; font-weight: 500; letter-spacing: .03em; pointer-events: none; }
[data-kind="supervision"] { --tp-edge: var(--tp-role-supervisor); }
[data-kind="delegation"] { --tp-edge: var(--tp-role-lead); }

.tp-hud { display: flex; flex-direction: column; gap: 10px; min-width: 232px; max-width: 320px; padding: 12px 14px; border: 1px solid var(--tp-border); border-radius: 14px; background: color-mix(in srgb, var(--tp-surface) 82%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); box-shadow: 0 12px 32px -14px rgba(0,0,0,.5); }
.tp-hud-title { display: flex; align-items: center; gap: 8px; color: var(--tp-fg); font-size: 13px; font-weight: 600; }
.tp-hud-sub { color: var(--tp-fg-muted); font-size: 11px; }
.tp-hud-row { display: flex; flex-wrap: wrap; gap: 6px 12px; }
.tp-hud-stat { display: inline-flex; align-items: center; gap: 6px; color: var(--tp-fg-muted); font-size: 11px; }
.tp-hud-stat b { color: var(--tp-fg); font-weight: 600; }
.tp-swatch { width: 8px; height: 8px; border-radius: 3px; background: var(--tp-role); }
.tp-line { width: 16px; height: 0; border-top: 2px solid var(--tp-edge); border-radius: 2px; }
.tp-hud-divider { height: 1px; background: var(--tp-border); }
.tp-warning { color: var(--tp-st-warning); font-size: 11px; }

.tp-page { display: flex; flex-direction: column; gap: 28px; width: 100%; max-width: 1280px; margin: 0 auto; font-family: inherit; }
.tp-page-title { color: var(--tp-fg); font-size: 20px; font-weight: 600; }
.tp-page-head { display: flex; flex-direction: column; gap: 8px; }
.tp-project { display: flex; flex-direction: column; gap: 10px; }
.tp-project-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; }
.tp-project-name { color: var(--tp-fg); font-size: 15px; font-weight: 600; margin-right: 4px; }
.tp-frame { position: relative; border: 1px solid var(--tp-border); border-radius: 16px; overflow: hidden; }

@keyframes tp-enter { from { opacity: 0; transform: translateY(6px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes tp-glow {
  0%, 100% { box-shadow: 0 0 0 1px color-mix(in srgb, var(--tp-st-running) 30%, transparent), 0 10px 30px -12px rgba(0,0,0,.45); }
  50% { box-shadow: 0 0 0 1px color-mix(in srgb, var(--tp-st-running) 70%, transparent), 0 0 28px -4px color-mix(in srgb, var(--tp-st-running) 55%, transparent); }
}
@keyframes tp-ping { from { transform: scale(.6); opacity: .9; } to { transform: scale(1.9); opacity: 0; } }
@keyframes tp-flow { to { stroke-dashoffset: -12; } }
@media (prefers-reduced-motion: reduce) {
  .tp-node, .tp-edge, .tp-dot::after { animation: none !important; }
  .tp-edge-spark { display: none; }
}
`;

function AgentTopologyNode({ data, selected }: NodeProps<FlowNode>) {
  const node = data.topologyNode;
  const RoleIcon = TOPOLOGY_ROLE_META[node.role].icon;
  const assignmentLabel = formatTopologyAssignment(node);
  return (
    <div
      className="tp-node"
      data-testid={`topology-agent-${node.id}`}
      data-role={node.role}
      data-status={node.status}
      data-selected={selected ? "true" : "false"}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <div className="tp-head">
        <span className="tp-role-icon">
          <RoleIcon color="currentColor" size={14} />
        </span>
        <span className="tp-role-label">{node.role.toUpperCase()}</span>
        <span className="tp-short-id">{node.shortId}</span>
        <span className="tp-head-spacer" />
        <span className="tp-status" data-status={node.status}>
          <span className="tp-dot" />
          {TOPOLOGY_STATUS_LABELS[node.status]}
        </span>
      </div>
      <div className="tp-title">{node.title}</div>
      <div className="tp-chips">
        <span className="tp-chip">
          <Cpu color="currentColor" size={11} />
          <span>
            {node.provider}/{node.model ?? "default"}
          </span>
        </span>
        <span className="tp-chip">
          <ShieldCheck color="currentColor" size={11} />
          <span>{node.modeId ?? "default"}</span>
        </span>
      </div>
      {node.launchProfile ? (
        <div className="tp-meta">
          Profile {node.launchProfile.name} ({node.launchProfile.id})
        </div>
      ) : null}
      {assignmentLabel ? <div className="tp-meta">{assignmentLabel}</div> : null}
      {node.requiresAttention ? (
        <div className="tp-attention">
          <TriangleAlert color="currentColor" size={12} />
          Needs attention
        </div>
      ) : null}
      {data.childSummary ? (
        <div className="tp-children">
          <GitFork color="currentColor" size={11} />
          <span>{data.childSummary}</span>
        </div>
      ) : null}
      {data.issues.length > 0 ? (
        <div className="tp-issues">
          <span className="tp-issues-label">Beads issues · {data.issues.length}</span>
          {data.issues.slice(0, TOPOLOGY_CARD_METRICS.maxIssues).map((issue) => (
            <div key={issue.id} className="tp-issue">
              <span className="tp-issue-id">{issue.id}</span>
              <span className="tp-issue-title">{issue.title === issue.id ? "" : issue.title}</span>
              <span className="tp-issue-status" data-issue-status={issue.status ?? "unknown"}>
                {issue.status?.replace("_", " ") ?? "unknown"}
              </span>
            </div>
          ))}
          {data.issues.length > TOPOLOGY_CARD_METRICS.maxIssues ? (
            <span className="tp-meta">
              +{data.issues.length - TOPOLOGY_CARD_METRICS.maxIssues} more
            </span>
          ) : null}
        </div>
      ) : null}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}

function RelationshipEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<FlowEdge>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const kind = data?.kind ?? "delegation";
  const active = data?.active ?? false;
  const labelStyle = useMemo<CSSProperties>(
    () => ({ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }),
    [labelX, labelY],
  );
  return (
    <>
      <g data-kind={kind}>
        <BaseEdge
          path={path}
          className="tp-edge"
          data-active={active ? "true" : "false"}
          data-inferred={data?.inferred ? "true" : "false"}
        />
        {active ? (
          <circle r={3} className="tp-edge-spark">
            <animateMotion dur="1.8s" repeatCount="indefinite" path={path} />
          </circle>
        ) : null}
      </g>
      {data?.showLabel ? (
        <EdgeLabelRenderer>
          <div className="tp-edge-label nodrag nopan" data-kind={kind} style={labelStyle}>
            {kind === "delegation" ? "delegates" : "supervises"}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const NODE_TYPES = { agent: AgentTopologyNode };
const EDGE_TYPES = { relationship: RelationshipEdge };
const FIT_VIEW_OPTIONS = { padding: 0.12, minZoom: 0.2, maxZoom: 1.15 };
const PACKED_COLUMNS = 4;

function layoutTopology(
  nodes: readonly TopologyNode[],
  edges: readonly TopologyEdge[],
  packed: boolean,
) {
  return packed
    ? layoutProjectTopologyPacked(nodes, edges, PACKED_COLUMNS)
    : layoutProjectTopologyXFirst(nodes, edges);
}

const selectPaneSize = (state: ReactFlowState) => `${state.width}x${state.height}`;

/**
 * The panel is often mounted while its tab is hidden or still resizing, which
 * leaves the first fit at a tiny zoom, and opening an agent beside the graph
 * narrows the pane under a viewport computed for the old width. React it to
 * the pane size React Flow itself measured (so the fit never reads stale
 * dimensions): re-fit until the user pans or zooms on their own, otherwise keep
 * the same canvas point centered — and re-fit anyway if no card stays visible.
 */
function AutoFit({
  nodeCount,
  userMovedRef,
}: {
  nodeCount: number;
  userMovedRef: { current: boolean };
}) {
  const { fitView, getNodes, getViewport, setViewport } = useReactFlow<FlowNode, FlowEdge>();
  const initialized = useNodesInitialized();
  const paneSize = useStore(selectPaneSize);
  const lastSizeRef = useRef<TopologySize | null>(null);
  useEffect(() => {
    if (!initialized) return;
    userMovedRef.current = false;
    void fitView(FIT_VIEW_OPTIONS);
  }, [fitView, initialized, nodeCount, userMovedRef]);
  useEffect(() => {
    const [width, height] = paneSize.split("x").map(Number);
    if (!width || !height) return;
    const size = { width, height };
    const previous = lastSizeRef.current;
    lastSizeRef.current = size;
    if (!initialized || !previous) return;
    if (previous.width === width && previous.height === height) return;
    if (!userMovedRef.current) {
      void fitView(FIT_VIEW_OPTIONS);
      return;
    }
    const next = recenterTopologyViewport(getViewport(), previous, size);
    const boxes = getNodes().map((node) => ({
      x: node.position.x,
      y: node.position.y,
      width: node.width ?? 0,
      height: node.height ?? 0,
    }));
    if (topologyViewportShowsAnyBox(boxes, next, size)) {
      void setViewport(next);
    } else {
      userMovedRef.current = false;
      void fitView(FIT_VIEW_OPTIONS);
    }
  }, [fitView, getNodes, getViewport, initialized, paneSize, setViewport, userMovedRef]);
  return null;
}

function toFlowNodes(
  nodes: readonly TopologyNode[],
  edges: readonly TopologyEdge[],
  issueById: ReadonlyMap<string, BeadsIssue>,
  packed: boolean,
): FlowNode[] {
  const boxes = layoutTopology(nodes, edges, packed);
  const childSummaries = summarizeChildren(nodes, edges);
  return nodes.map((node) => {
    const box = boxes.get(node.id);
    const height = box?.height ?? 0;
    return {
      id: node.id,
      type: "agent",
      position: { x: box?.x ?? 0, y: box?.y ?? 0 },
      width: TOPOLOGY_NODE_WIDTH,
      height,
      style: { width: TOPOLOGY_NODE_WIDTH, height },
      data: {
        topologyNode: node,
        childSummary: childSummaries.get(node.id) ?? null,
        issues: node.issueIds.map((issueId) => {
          const issue = issueById.get(issueId);
          return {
            id: issueId,
            title: issue?.title ?? issueId,
            status: issue?.status ?? null,
          };
        }),
      },
      draggable: false,
      connectable: false,
      deletable: false,
      selectable: true,
      ariaLabel: `Open ${node.title}, ${node.role}, ${node.status}, ${node.issueIds.length} assigned issues`,
    };
  });
}

function summarizeChildren(
  nodes: readonly TopologyNode[],
  edges: readonly TopologyEdge[],
): Map<string, string> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string, TopologyNode[]>();
  for (const edge of edges) {
    const child = nodeById.get(edge.target);
    if (!child || !nodeById.has(edge.source)) continue;
    childrenByParent.set(edge.source, [...(childrenByParent.get(edge.source) ?? []), child]);
  }
  const summaries = new Map<string, string>();
  for (const [parentId, children] of childrenByParent) {
    const parent = nodeById.get(parentId);
    const verb = parent?.role === "supervisor" ? "Supervises" : "Delegates to";
    const roleCounts = TOPOLOGY_ROLE_ORDER.flatMap((role) => {
      const count = children.filter((child) => child.role === role).length;
      if (count === 0) return [];
      const meta = TOPOLOGY_ROLE_META[role];
      return [`${count} ${count === 1 ? meta.label : meta.plural}`];
    });
    const running = children.filter((child) => isActiveStatus(child.status)).length;
    summaries.set(
      parentId,
      `${verb} ${roleCounts.join(", ")}${running > 0 ? ` · ${running} running` : ""}`,
    );
  }
  return summaries;
}

function isActiveStatus(status: TopologyNode["status"] | undefined): boolean {
  return status === "running" || status === "initializing";
}

export interface TopologyHudProps {
  projectName: string;
  agentCount: number;
  edgeCount: number;
  roleCounts: Record<TopologyRole, number>;
  statusCounts: { status: TopologyNode["status"]; count: number }[];
  edgeKinds: TopologyEdge["kind"][];
  warningCount: number;
  grantedIssueCount: number;
  issuesLoading: boolean;
  issuesUnavailable: boolean;
}

function TopologyHud({
  projectName,
  agentCount,
  edgeCount,
  roleCounts,
  statusCounts,
  edgeKinds,
  warningCount,
  grantedIssueCount,
  issuesLoading,
  issuesUnavailable,
}: TopologyHudProps) {
  return (
    <div className="tp-hud">
      <div>
        <div className="tp-hud-title">
          <Network color="currentColor" size={14} />
          {projectName}
        </div>
        <div className="tp-hud-sub">Project topology</div>
      </div>
      <div className="tp-hud-row">
        {TOPOLOGY_ROLE_ORDER.filter((role) => roleCounts[role] > 0).map((role) => (
          <span key={role} className="tp-hud-stat" data-role={role}>
            <span className="tp-swatch" />
            <b>{roleCounts[role]}</b>
            {roleCounts[role] === 1
              ? TOPOLOGY_ROLE_META[role].label
              : TOPOLOGY_ROLE_META[role].plural}
          </span>
        ))}
      </div>
      <div className="tp-hud-row">
        {statusCounts.map(({ status, count }) => (
          <span key={status} className="tp-hud-stat" data-status={status}>
            <span className="tp-dot" />
            <b>{count}</b>
            {TOPOLOGY_STATUS_LABELS[status]}
          </span>
        ))}
      </div>
      <div className="tp-hud-divider" />
      <div className="tp-hud-sub">
        {agentCount} agents · {edgeCount} relationship
        {edgeCount === 1 ? "" : "s"}
      </div>
      <div className="tp-hud-sub">
        {grantedIssueCount} assigned issue
        {grantedIssueCount === 1 ? "" : "s"}
      </div>
      {edgeKinds.length > 0 ? (
        <div className="tp-hud-row">
          {edgeKinds.map((kind) => (
            <span key={kind} className="tp-hud-stat" data-kind={kind}>
              <span className="tp-line" />
              {kind === "delegation" ? "Delegation" : "Supervision"}
            </span>
          ))}
        </div>
      ) : null}
      {warningCount > 0 ? (
        <div className="tp-warning">
          {warningCount} relationship
          {warningCount === 1 ? "" : "s"} need review
        </div>
      ) : null}
      {issuesLoading && grantedIssueCount > 0 ? (
        <div className="tp-hud-sub">Loading issue details</div>
      ) : null}
      {issuesUnavailable && grantedIssueCount > 0 ? (
        <div className="tp-warning">Issue details unavailable; exact grants remain shown</div>
      ) : null}
    </div>
  );
}

interface TopologyCanvasProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  hud: TopologyHudProps | null;
  embedded: boolean;
  testID?: string;
  onOpenAgent: (agentId: string) => void;
  themeVars?: CSSProperties;
  colorScheme?: "light" | "dark";
  dotColor?: string;
}

function TopologyCanvas({
  nodes,
  edges,
  hud,
  embedded,
  testID,
  onOpenAgent,
  themeVars,
  colorScheme,
  dotColor,
}: TopologyCanvasProps) {
  const userMovedRef = useRef(false);
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: FlowNode) => onOpenAgent(node.id),
    [onOpenAgent],
  );
  // Non-draggable cards start a pan on mousedown, so clicking one emits move
  // events for pointer jitter. Only a deliberate pan or zoom stops auto-fit;
  // programmatic moves (fitView, resize recentering) carry no event.
  const moveStartRef = useRef<Viewport | null>(null);
  const handleMoveStart = useCallback(
    (event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
      moveStartRef.current = event ? viewport : null;
    },
    [],
  );
  const handleMove = useCallback((event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
    const start = moveStartRef.current;
    if (!event) return;
    if (!start || isDeliberateViewportChange(start, viewport)) userMovedRef.current = true;
  }, []);
  return (
    <div className="tp-root" style={themeVars} data-testid={testID}>
      <style>{TOPOLOGY_CSS}</style>
      <ReactFlow<FlowNode, FlowEdge>
        key="project-horizontal"
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodeClick={handleNodeClick}
        onMoveStart={handleMoveStart}
        onMove={handleMove}
        colorMode={colorScheme}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        minZoom={0.15}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesReconnectable={false}
        elementsSelectable
        panOnDrag
        zoomOnScroll={!embedded}
        zoomOnPinch
        preventScrolling={!embedded}
        deleteKeyCode={null}
      >
        <AutoFit nodeCount={nodes.length} userMovedRef={userMovedRef} />
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color={dotColor} />
        <Controls
          position="bottom-right"
          showInteractive={false}
          fitViewOptions={FIT_VIEW_OPTIONS}
        />
        {hud ? (
          <Panel position="top-left">
            <TopologyHud {...hud} />
          </Panel>
        ) : null}
      </ReactFlow>
    </div>
  );
}

const ThemedTopologyCanvas = withUnistyles(TopologyCanvas);
const canvasThemeMapping = (theme: Theme) => {
  const roleColors = ROLE_COLORS[theme.colorScheme];
  return {
    colorScheme: theme.colorScheme,
    dotColor: theme.colors.border,
    themeVars: {
      "--tp-bg": theme.colors.surface0,
      "--tp-surface": theme.colors.surface1,
      "--tp-surface-hover": theme.colors.surface2,
      "--tp-chip": theme.colors.surface2,
      "--tp-border": theme.colors.border,
      "--tp-fg": theme.colors.foreground,
      "--tp-fg-muted": theme.colors.foregroundMuted,
      "--tp-fg-faint": theme.colors.foregroundExtraMuted,
      "--tp-role-supervisor": roleColors.supervisor,
      "--tp-role-lead": roleColors.lead,
      "--tp-role-peer": roleColors.peer,
      "--tp-role-unbound": theme.colors.foregroundMuted,
      "--tp-st-success": theme.colors.statusDotSuccess,
      "--tp-st-running": theme.colors.statusDotRunning,
      "--tp-st-warning": theme.colors.statusDotWarning,
      "--tp-st-danger": theme.colors.statusDotDanger,
    } as CSSProperties,
  };
};

const EMPTY_ISSUES: ReadonlyMap<string, BeadsIssue> = new Map();

export function summarizeTopologyStatuses(
  nodes: readonly TopologyNode[],
): { status: TopologyNode["status"]; count: number }[] {
  const counts = new Map<TopologyNode["status"], number>();
  for (const node of nodes) counts.set(node.status, (counts.get(node.status) ?? 0) + 1);
  return STATUS_ORDER.flatMap((status) => {
    const count = counts.get(status) ?? 0;
    return count > 0 ? [{ status, count }] : [];
  });
}

/** Size of the embedded (packed) graph at full zoom, for hosts that scroll the page instead. */
export function estimateTopologyGraphSize(
  nodes: readonly TopologyNode[],
  edges: readonly TopologyEdge[],
): { width: number; height: number } {
  let width = 0;
  let height = 0;
  for (const box of layoutTopology(nodes, edges, true).values()) {
    width = Math.max(width, box.x + box.width);
    height = Math.max(height, box.y + box.height);
  }
  return { width, height };
}

export interface TopologyGraphProps {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  issueById?: ReadonlyMap<string, BeadsIssue>;
  hud?: TopologyHudProps | null;
  /**
   * The page owns scrolling: the wheel scrolls past the graph instead of zooming
   * it, and unrelated agents pack into a grid to keep the graph short.
   */
  embedded?: boolean;
  testID?: string;
  onOpenAgent: (agentId: string) => void;
}

/** Fills its nearest positioned ancestor, which must have a definite size. */
export function TopologyGraph({
  nodes,
  edges,
  issueById = EMPTY_ISSUES,
  hud = null,
  embedded = false,
  testID,
  onOpenAgent,
}: TopologyGraphProps) {
  const flowEdges = useMemo<FlowEdge[]>(() => {
    const statusById = new Map(nodes.map((node) => [node.id, node.status]));
    const labelledParents = new Set<string>();
    return edges.map((edge) => {
      const showLabel = !labelledParents.has(edge.source);
      labelledParents.add(edge.source);
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "relationship",
        data: {
          kind: edge.kind,
          active: isActiveStatus(statusById.get(edge.target)),
          inferred: edge.provenance === "inferred",
          showLabel,
        },
        selectable: false,
      };
    });
  }, [edges, nodes]);
  const flowNodes = useMemo(
    () => toFlowNodes(nodes, edges, issueById, embedded),
    [edges, embedded, issueById, nodes],
  );
  return (
    <ThemedTopologyCanvas
      nodes={flowNodes}
      edges={flowEdges}
      hud={hud}
      embedded={embedded}
      testID={testID}
      onOpenAgent={onOpenAgent}
      uniProps={canvasThemeMapping}
    />
  );
}

function TopologyThemeScope({
  themeVars,
  children,
}: {
  themeVars?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className="tp-theme" style={themeVars}>
      <style>{TOPOLOGY_CSS}</style>
      {children}
    </div>
  );
}

const ThemedTopologyThemeScope = withUnistyles(TopologyThemeScope);
const themeScopeMapping = (theme: Theme) => ({ themeVars: canvasThemeMapping(theme).themeVars });

/** Exposes the graph's role/status CSS variables and classes to surrounding DOM. */
export function TopologyTheme({ children }: { children: ReactNode }) {
  return (
    <ThemedTopologyThemeScope uniProps={themeScopeMapping}>{children}</ThemedTopologyThemeScope>
  );
}
