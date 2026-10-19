import "@xyflow/react/dist/style.css";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  Handle,
  Panel,
  Position,
  ReactFlow,
  getSmoothStepPath,
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
  CircleDot,
  Compass,
  Crown,
  GitFork,
  Network,
  ShieldAlert,
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
  formatTopologyModelName,
  formatTopologyProviderName,
  isElevatedTopologyMode,
  shortTopologyProfileName,
  type TopologyEdge,
  type TopologyNode,
  type TopologyRole,
} from "@/panels/topology-model";
import {
  TOPOLOGY_NODE_HEIGHT,
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
  /** "2 Peers · 1 running", or null for an agent with no children. */
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
  /** The child is running, so the relationship carries live work. */
  active: boolean;
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
// color is never read as agent state.
const ROLE_COLORS = {
  dark: { supervisor: "#a78bfa", lead: "#22d3ee", peer: "#f472b6" },
  light: { supervisor: "#7c3aed", lead: "#0891b2", peer: "#db2777" },
} as const;

const ISSUE_STATUS_LABELS: Record<BeadsIssue["status"], string> = {
  open: "Open",
  in_progress: "In progress",
  blocked: "Blocked",
  deferred: "Deferred",
  closed: "Closed",
};
// The footer shows the issue that most needs eyes first.
const ISSUE_STATUS_PRIORITY: Record<BeadsIssue["status"], number> = {
  blocked: 0,
  in_progress: 1,
  open: 2,
  deferred: 3,
  closed: 4,
};

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

const TOPOLOGY_CSS = `
.tp-root { position: absolute; inset: 0; overflow: hidden; background: var(--tp-bg); font-family: inherit; }
.tp-theme { display: contents; }
.tp-root .react-flow { background: transparent; }
.tp-root .react-flow__handle { opacity: 0; width: 1px; height: 1px; min-width: 0; min-height: 0; border: 0; pointer-events: none; }
.tp-root .react-flow__node { cursor: pointer; }
.tp-root .react-flow__node:focus-visible { outline: none; }
.tp-root .react-flow__node:focus-visible .tp-node { box-shadow: 0 0 0 2px var(--tp-role); }
.tp-root .react-flow__attribution { display: none; }
.tp-root .react-flow__controls { border: 1px solid var(--tp-border); border-radius: 8px; overflow: hidden; box-shadow: none; }
.tp-root .react-flow__controls-button { background: var(--tp-surface); border-bottom: 1px solid var(--tp-border); color: var(--tp-fg-muted); fill: currentColor; width: 26px; height: 26px; }
.tp-root .react-flow__controls-button:last-child { border-bottom: 0; }
.tp-root .react-flow__controls-button:hover { background: var(--tp-surface-hover); color: var(--tp-fg); }

.tp-node {
  --tp-role: var(--tp-role-unbound);
  position: relative; width: 100%; height: 100%; box-sizing: border-box; padding: 12px 14px;
  display: flex; flex-direction: column;
  border: 1px solid var(--tp-border); border-radius: 12px; overflow: hidden;
  background: var(--tp-surface);
  transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease;
  animation: tp-enter .3s ease-out both;
}
[data-role="supervisor"] { --tp-role: var(--tp-role-supervisor); }
[data-role="lead"] { --tp-role: var(--tp-role-lead); }
[data-role="peer"] { --tp-role: var(--tp-role-peer); }
.tp-node:hover { border-color: var(--tp-border-strong); }
.tp-node[data-selected="true"] { border-color: color-mix(in srgb, var(--tp-role) 60%, var(--tp-border)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--tp-role) 16%, transparent); }
.tp-node[data-status="closed"] { opacity: .55; }

.tp-head { display: flex; align-items: center; gap: 6px; height: 20px; flex: none; }
.tp-role-icon { color: var(--tp-role); display: flex; align-items: center; }
.tp-role-label { color: var(--tp-role); font-size: 10.5px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
.tp-head-spacer { flex: 1; }
.tp-flag { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 6px; color: var(--tp-fg-faint); }
.tp-flag[data-flag="attention"] { color: var(--tp-st-warning); background: color-mix(in srgb, var(--tp-st-warning) 14%, transparent); }
.tp-status { display: inline-flex; align-items: center; gap: 6px; height: 20px; box-sizing: border-box; padding: 0 8px 0 7px; border-radius: 999px; font-size: 11px; font-weight: 400; color: var(--tp-fg-muted); background: color-mix(in srgb, var(--tp-status) 13%, transparent); white-space: nowrap; }
.tp-dot { position: relative; width: 6px; height: 6px; border-radius: 50%; background: var(--tp-status); flex: none; }
[data-status="running"] > .tp-dot::after, [data-status="initializing"] > .tp-dot::after {
  content: ""; position: absolute; inset: -3px; border-radius: 50%; border: 1px solid var(--tp-status); animation: tp-ping 1.8s ease-out infinite;
}
[data-status="initializing"] { --tp-status: var(--tp-st-warning); }
[data-status="idle"] { --tp-status: var(--tp-st-success); }
[data-status="running"] { --tp-status: var(--tp-st-running); }
[data-status="error"] { --tp-status: var(--tp-st-danger); }
[data-status="closed"] { --tp-status: var(--tp-fg-faint); }
.tp-status[data-status="running"] { color: var(--tp-st-running); }
.tp-status[data-status="error"] { color: var(--tp-st-danger); }

.tp-title { flex: none; margin-top: 8px; max-height: 36px; color: var(--tp-fg); font-size: 13px; font-weight: 500; line-height: 18px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
.tp-meta { flex: none; margin-top: 4px; height: 16px; line-height: 16px; font-size: 11.5px; color: var(--tp-fg-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-meta-sep { color: var(--tp-fg-faint); padding: 0 5px; }
.tp-meta-faint { color: var(--tp-fg-faint); }

.tp-foot { flex: none; margin-top: auto; height: 28px; box-sizing: border-box; padding-top: 9px; border-top: 1px solid var(--tp-border); display: flex; align-items: center; gap: 6px; font-size: 11px; line-height: 18px; color: var(--tp-fg-muted); min-width: 0; }
.tp-foot-icon { flex: none; display: flex; color: var(--tp-fg-faint); }
.tp-foot-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-foot-count { color: var(--tp-fg); }
.tp-foot-status { flex: none; white-space: nowrap; color: var(--tp-fg-faint); }
.tp-foot-status[data-issue-status="in_progress"] { color: var(--tp-st-running); }
.tp-foot-status[data-issue-status="blocked"] { color: var(--tp-st-danger); }
.tp-foot-id { flex: none; color: var(--tp-fg-faint); font-family: ${MONO}; font-size: 10.5px; }

.tp-edge { stroke: var(--tp-edge); stroke-width: 1.25; stroke-opacity: .45; fill: none; }
.tp-edge-flow { stroke: var(--tp-edge); stroke-width: 1.5; stroke-opacity: .9; fill: none; stroke-linecap: round; stroke-dasharray: 1 9; animation: tp-flow 1.2s linear infinite; pointer-events: none; }
[data-kind="supervision"] { --tp-edge: var(--tp-role-supervisor); }
[data-kind="delegation"] { --tp-edge: var(--tp-role-lead); }

.tp-hud { display: flex; flex-direction: column; gap: 10px; width: 320px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 12px; border: 1px solid var(--tp-border); border-radius: 12px; background: color-mix(in srgb, var(--tp-surface) 92%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.tp-hud-head { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.tp-hud-title { display: flex; align-items: center; gap: 7px; min-width: 0; color: var(--tp-fg); font-size: 13px; font-weight: 500; }
.tp-hud-title > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-hud-title > svg { color: var(--tp-fg-muted); flex: none; }
.tp-hud-activity { display: flex; align-items: center; gap: 5px; padding-left: 20px; font-size: 11px; line-height: 16px; color: var(--tp-fg-muted); white-space: nowrap; }
.tp-hud-activity-running { display: inline-flex; align-items: center; gap: 5px; color: var(--tp-st-running); }
.tp-hud-activity-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.tp-hud-tiles { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 1px; border: 1px solid var(--tp-border); border-radius: 8px; overflow: hidden; background: var(--tp-border); }
.tp-hud-tile { display: flex; flex-direction: column; gap: 1px; padding: 7px 9px; background: var(--tp-surface); min-width: 0; }
.tp-hud-tile-value { font-size: 16px; font-weight: 500; line-height: 20px; color: var(--tp-role, var(--tp-fg)); font-variant-numeric: tabular-nums; }
.tp-hud-tile-label { font-size: 10.5px; line-height: 14px; color: var(--tp-fg-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-hud-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; }
.tp-hud-legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--tp-fg-muted); white-space: nowrap; }
.tp-hud-sub { color: var(--tp-fg-muted); font-size: 11px; }
.tp-hud-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; }
.tp-hud-stat { display: inline-flex; align-items: center; gap: 5px; color: var(--tp-fg-muted); font-size: 11px; white-space: nowrap; }
.tp-hud-stat b { color: var(--tp-fg); font-weight: 500; }
.tp-hud-stat > .tp-dot::after { display: none; }
.tp-swatch { width: 6px; height: 6px; border-radius: 50%; background: var(--tp-role); }
.tp-line { width: 16px; height: 2px; border-radius: 2px; background: var(--tp-edge); }
.tp-warning { color: var(--tp-st-warning); font-size: 11px; }

.tp-page { container: tp-page / inline-size; display: flex; flex-direction: column; gap: 28px; width: 100%; max-width: 1280px; margin: 0 auto; font-family: inherit; }
.tp-page-title { color: var(--tp-fg); font-size: 20px; font-weight: 500; }
.tp-page-head { display: flex; flex-direction: column; gap: 8px; }
.tp-project { display: flex; flex-direction: column; gap: 10px; }
.tp-project-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; }
.tp-project-name { color: var(--tp-fg); font-size: 14px; font-weight: 500; margin-right: 4px; }
.tp-frame { position: relative; border: 1px solid var(--tp-border); border-radius: 12px; overflow: hidden; }

.tp-ov-head { display: flex; flex-direction: column; gap: 6px; }
.tp-ov-summary { display: flex; flex-wrap: wrap; gap: 6px; }
.tp-ov-chip { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 9px; border-radius: 999px; font-size: 11.5px; color: var(--tp-fg-muted); background: var(--tp-surface); border: 1px solid var(--tp-border); white-space: nowrap; }
.tp-ov-chip b { color: var(--tp-fg); font-weight: 500; }
.tp-ov-list { display: flex; flex-direction: column; border: 1px solid var(--tp-border); border-radius: 12px; overflow: hidden; background: var(--tp-surface); }
.tp-ov-item + .tp-ov-item { border-top: 1px solid var(--tp-border); }
.tp-ov-row { display: grid; grid-template-columns: 104px minmax(0, 1fr) auto 72px 16px; align-items: center; gap: 14px; padding: 12px 14px; cursor: pointer; outline: none; }
.tp-ov-row:hover, .tp-ov-row:focus-visible { background: var(--tp-surface-hover); }
.tp-ov-state { display: inline-flex; align-items: center; gap: 6px; justify-self: start; height: 22px; padding: 0 9px; border-radius: 999px; font-size: 11.5px; white-space: nowrap; color: var(--tp-ov); background: color-mix(in srgb, var(--tp-ov) 14%, transparent); }
.tp-ov-state-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
[data-state="needs-you"] { --tp-ov: var(--tp-st-danger); }
[data-state="working"] { --tp-ov: var(--tp-st-running); }
[data-state="review"] { --tp-ov: var(--tp-st-warning); }
[data-state="idle"] { --tp-ov: var(--tp-st-success); }
[data-state="inactive"] { --tp-ov: var(--tp-fg-faint); }
.tp-ov-state[data-state="inactive"] { color: var(--tp-fg-muted); background: var(--tp-surface-hover); }
.tp-ov-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.tp-ov-name { color: var(--tp-fg); font-size: 13.5px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-ov-focus { display: flex; gap: 6px; min-width: 0; font-size: 12px; color: var(--tp-fg-muted); white-space: nowrap; overflow: hidden; }
.tp-ov-agent { display: inline-flex; align-items: center; gap: 5px; min-width: 0; overflow: hidden; text-overflow: ellipsis; border-radius: 4px; }
.tp-ov-agent + .tp-ov-agent::before { content: "·"; color: var(--tp-fg-faint); margin-right: 1px; }
.tp-ov-agent:hover { color: var(--tp-fg); text-decoration: underline; text-underline-offset: 2px; }
.tp-ov-agent-role { flex: none; color: var(--tp-role); font-size: 10px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
.tp-ov-agent-title { overflow: hidden; text-overflow: ellipsis; }
.tp-ov-more { flex: none; color: var(--tp-fg-faint); }
.tp-ov-counts { display: flex; gap: 10px; font-size: 11.5px; color: var(--tp-fg-muted); white-space: nowrap; }
.tp-ov-counts b { color: var(--tp-fg); font-weight: 500; }
.tp-ov-count[data-tone="danger"] b { color: var(--tp-st-danger); }
.tp-ov-count[data-tone="running"] b { color: var(--tp-st-running); }
.tp-ov-count[data-tone="warning"] b { color: var(--tp-st-warning); }
.tp-ov-time { justify-self: end; font-size: 11.5px; color: var(--tp-fg-faint); white-space: nowrap; font-variant-numeric: tabular-nums; }
.tp-ov-chevron { color: var(--tp-fg-faint); display: flex; transition: transform .15s ease; }
.tp-ov-row[aria-expanded="true"] .tp-ov-chevron, .tp-ov-group[aria-expanded="true"] .tp-ov-chevron { transform: rotate(90deg); }
.tp-ov-graph { position: relative; border-top: 1px solid var(--tp-border); background: var(--tp-bg); }
.tp-ov-focus[data-live] { flex-direction: column; gap: 3px; }
.tp-ov-focus[data-live] .tp-ov-agent + .tp-ov-agent::before { content: none; }
.tp-ov-activity { display: inline-flex; flex: 0 1 auto; align-items: center; gap: 6px; color: var(--tp-fg-faint); }
.tp-ov-focus[data-live] .tp-ov-agent { max-width: 100%; }
.tp-ov-focus[data-live] .tp-ov-agent-title { flex: 0 1 auto; min-width: 4ch; }
.tp-ov-activity::before { content: "—"; flex: none; }
.tp-ov-activity-label { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--tp-fg-muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
.tp-ov-activity-time { flex: none; color: var(--tp-st-running); font-variant-numeric: tabular-nums; }
.tp-inbox { display: flex; flex-direction: column; gap: 8px; }
.tp-inbox-title { display: flex; align-items: center; gap: 8px; color: var(--tp-fg); font-size: 13px; font-weight: 500; }
.tp-inbox-count { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; font-size: 11px; color: var(--tp-st-danger); background: color-mix(in srgb, var(--tp-st-danger) 14%, transparent); }
.tp-inbox-row { display: grid; grid-template-columns: 104px minmax(0, 1fr) auto 16px; align-items: center; gap: 14px; padding: 10px 14px; cursor: pointer; outline: none; }
.tp-inbox-row + .tp-inbox-row { border-top: 1px solid var(--tp-border); }
.tp-inbox-row:hover, .tp-inbox-row:focus-visible { background: var(--tp-surface-hover); }
.tp-inbox-agent { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 12.5px; color: var(--tp-fg); white-space: nowrap; overflow: hidden; }
.tp-inbox-project { flex: none; color: var(--tp-fg-muted); }
.tp-inbox-project::after { content: "›"; margin-left: 8px; color: var(--tp-fg-faint); }
.tp-inbox-detail { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; color: var(--tp-fg-muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.tp-ov-group { display: flex; align-items: center; gap: 8px; padding: 0 2px; color: var(--tp-fg-muted); font-size: 12px; cursor: pointer; user-select: none; }
.tp-ov-group:hover { color: var(--tp-fg); }
@container tp-page (max-width: 640px) {
  .tp-ov-row { grid-template-columns: minmax(0, 1fr) auto 16px; row-gap: 6px; }
  .tp-ov-state { grid-column: 1; grid-row: 1; }
  .tp-ov-time { grid-column: 2; grid-row: 1; }
  .tp-ov-chevron { grid-column: 3; grid-row: 1; }
  .tp-ov-main { grid-column: 1 / -1; grid-row: 2; }
  .tp-ov-counts { grid-column: 1 / -1; grid-row: 3; }
  .tp-inbox-row { grid-template-columns: minmax(0, 1fr) auto 16px; row-gap: 6px; }
  .tp-inbox-row .tp-ov-state { grid-column: 1; grid-row: 1; }
  .tp-inbox-row .tp-ov-time { grid-column: 2; grid-row: 1; }
  .tp-inbox-row .tp-ov-chevron { grid-column: 3; grid-row: 1; }
  .tp-inbox-row .tp-ov-main { grid-column: 1 / -1; grid-row: 2; }
}

@keyframes tp-enter { from { opacity: 0; } to { opacity: 1; } }
@keyframes tp-ping { from { transform: scale(.6); opacity: .8; } to { transform: scale(2); opacity: 0; } }
@keyframes tp-flow { to { stroke-dashoffset: -20; } }
@media (prefers-reduced-motion: reduce) {
  .tp-node, .tp-edge-flow, .tp-dot::after { animation: none !important; }
}
`;

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function CardFooter({ data, shortId }: { data: FlowNodeData; shortId: string }) {
  const issue = data.issues[0];
  if (issue) {
    const count = data.issues.length;
    const hasTitle = issue.title !== issue.id;
    return (
      <div className="tp-foot" title={hasTitle ? issue.title : undefined}>
        <span className="tp-foot-icon">
          <CircleDot color="currentColor" size={12} />
        </span>
        <span className="tp-foot-text">
          {count > 1 || !hasTitle ? (
            <span className="tp-foot-count">{pluralize(count, "issue")}</span>
          ) : null}
          {count > 1 && hasTitle ? " · " : null}
          {hasTitle ? issue.title : null}
        </span>
        {issue.status ? (
          <span className="tp-foot-status" data-issue-status={issue.status}>
            {ISSUE_STATUS_LABELS[issue.status]}
          </span>
        ) : null}
      </div>
    );
  }
  return (
    <div className="tp-foot">
      {data.childSummary ? (
        <>
          <span className="tp-foot-icon">
            <GitFork color="currentColor" size={12} />
          </span>
          <span className="tp-foot-text">{data.childSummary}</span>
        </>
      ) : (
        <span className="tp-foot-text" />
      )}
      <span className="tp-foot-id">{shortId}</span>
    </div>
  );
}

function AgentTopologyNode({ data, selected }: NodeProps<FlowNode>) {
  const node = data.topologyNode;
  const RoleIcon = TOPOLOGY_ROLE_META[node.role].icon;
  const modelName = formatTopologyModelName(node.model) ?? "Default model";
  const providerName = formatTopologyProviderName(node.provider);
  const profileName = node.launchProfile ? shortTopologyProfileName(node.launchProfile.name) : null;
  const elevated = isElevatedTopologyMode(node.modeId);
  const assignmentLabel = formatTopologyAssignment(node);
  const routeTitle = [
    `${node.provider}/${node.model ?? "default"}`,
    node.modeId ? `mode ${node.modeId}` : null,
    node.launchProfile ? `profile ${node.launchProfile.name} (${node.launchProfile.id})` : null,
    assignmentLabel,
  ]
    .filter(Boolean)
    .join("\n");
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
          <RoleIcon color="currentColor" size={13} />
        </span>
        <span className="tp-role-label">{TOPOLOGY_ROLE_META[node.role].label}</span>
        <span className="tp-head-spacer" />
        {node.requiresAttention ? (
          <span
            className="tp-flag"
            data-flag="attention"
            title="Needs attention"
            aria-label="Needs attention"
          >
            <TriangleAlert color="currentColor" size={12} />
          </span>
        ) : null}
        {elevated ? (
          <span
            className="tp-flag"
            data-flag="elevated"
            title={`Runs without approval prompts (${node.modeId})`}
            aria-label="Runs without approval prompts"
          >
            <ShieldAlert color="currentColor" size={12} />
          </span>
        ) : null}
        <span className="tp-status" data-status={node.status}>
          <span className="tp-dot" />
          {TOPOLOGY_STATUS_LABELS[node.status]}
        </span>
      </div>
      <div className="tp-title" title={node.title}>
        {node.title}
      </div>
      <div className="tp-meta" title={routeTitle}>
        {modelName}
        <span className="tp-meta-sep">·</span>
        <span className="tp-meta-faint">{profileName ?? providerName}</span>
      </div>
      <CardFooter data={data} shortId={node.shortId} />
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
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  });
  const kind = data?.kind ?? "delegation";
  return (
    <g data-kind={kind}>
      <BaseEdge path={path} className="tp-edge" />
      {data?.active ? <path d={path} className="tp-edge-flow" /> : null}
    </g>
  );
}

const NODE_TYPES = { agent: AgentTopologyNode };
const EDGE_TYPES = { relationship: RelationshipEdge };
const FIT_VIEW_OPTIONS = { padding: 0.14, minZoom: 0.2, maxZoom: 1.1 };
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
    const height = box?.height ?? TOPOLOGY_NODE_HEIGHT;
    const issues = node.issueIds
      .map((issueId) => {
        const issue = issueById.get(issueId);
        return { id: issueId, title: issue?.title ?? issueId, status: issue?.status ?? null };
      })
      .sort(
        (left, right) =>
          (left.status ? ISSUE_STATUS_PRIORITY[left.status] : 5) -
          (right.status ? ISSUE_STATUS_PRIORITY[right.status] : 5),
      );
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
        issues,
      },
      draggable: false,
      connectable: false,
      deletable: false,
      selectable: true,
      ariaLabel: `Open ${node.title}, ${node.role}, ${node.status}${
        node.requiresAttention ? ", needs attention" : ""
      }, ${node.issueIds.length} assigned issues`,
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
    const roleCounts = TOPOLOGY_ROLE_ORDER.flatMap((role) => {
      const count = children.filter((child) => child.role === role).length;
      if (count === 0) return [];
      const meta = TOPOLOGY_ROLE_META[role];
      return [`${count} ${count === 1 ? meta.label : meta.plural}`];
    });
    const running = children.filter((child) => isActiveStatus(child.status)).length;
    summaries.set(
      parentId,
      `${roleCounts.join(", ")}${running > 0 ? ` · ${running} running` : ""}`,
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
  const activeCount = statusCounts
    .filter(({ status }) => isActiveStatus(status))
    .reduce((sum, { count }) => sum + count, 0);
  const idleCount = statusCounts.find(({ status }) => status === "idle")?.count ?? 0;
  const statusTitle = statusCounts
    .map(({ status, count }) => `${count} ${TOPOLOGY_STATUS_LABELS[status]}`)
    .join(" · ");
  return (
    <div className="tp-hud" aria-label={`${projectName} topology summary`}>
      <div className="tp-hud-head">
        <div
          className="tp-hud-title"
          title={`${pluralize(agentCount, "agent")} · ${pluralize(edgeCount, "relationship")}`}
        >
          <Network color="currentColor" size={13} />
          <span>{projectName}</span>
        </div>
        <div className="tp-hud-activity" title={statusTitle}>
          {activeCount > 0 ? (
            <span className="tp-hud-activity-running">
              <span className="tp-hud-activity-dot" />
              {activeCount} running
            </span>
          ) : (
            <span>All idle</span>
          )}
          {activeCount > 0 && idleCount > 0 ? <span>· {idleCount} idle</span> : null}
        </div>
      </div>
      <div className="tp-hud-tiles">
        {TOPOLOGY_ROLE_ORDER.filter((role) => roleCounts[role] > 0).map((role) => (
          <div key={role} className="tp-hud-tile" data-role={role}>
            <span className="tp-hud-tile-value">{roleCounts[role]}</span>
            <span className="tp-hud-tile-label">
              {roleCounts[role] === 1
                ? TOPOLOGY_ROLE_META[role].label
                : TOPOLOGY_ROLE_META[role].plural}
            </span>
          </div>
        ))}
        {grantedIssueCount > 0 ? (
          <div className="tp-hud-tile">
            <span className="tp-hud-tile-value">{issuesLoading ? "–" : grantedIssueCount}</span>
            <span className="tp-hud-tile-label">
              {grantedIssueCount === 1 ? "Issue" : "Issues"}
            </span>
          </div>
        ) : null}
      </div>
      <div className="tp-hud-legend">
        {edgeKinds.map((kind) => (
          <span key={kind} className="tp-hud-legend-item" data-kind={kind}>
            <span className="tp-line" />
            {kind === "delegation" ? "Delegates" : "Supervises"}
          </span>
        ))}
      </div>
      {warningCount > 0 ? (
        <div className="tp-warning">{pluralize(warningCount, "relationship")} need review</div>
      ) : null}
      {issuesUnavailable && grantedIssueCount > 0 ? (
        <div className="tp-warning">Issue details unavailable</div>
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
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color={dotColor} />
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
      "--tp-border-strong": theme.colors.borderAccent,
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
    return edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "relationship",
      data: { kind: edge.kind, active: isActiveStatus(statusById.get(edge.target)) },
      selectable: false,
    }));
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
