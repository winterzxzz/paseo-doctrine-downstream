import "@xyflow/react/dist/style.css";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  Handle,
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
  Activity,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Compass,
  Clock,
  Crown,
  LayoutList,
  Network,
  PanelRightClose,
  PanelRightOpen,
  Waypoints,
  ShieldAlert,
  ShieldQuestion,
  TriangleAlert,
} from "lucide-react-native";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  TOPOLOGY_NODE_WIDTH,
  isDeliberateViewportChange,
  topologyCardHeight,
  topologyTitleLines,
  layoutProjectTopologyPacked,
  layoutProjectTopologyXFirst,
  recenterTopologyViewport,
  topologyViewportShowsAnyBox,
  type TopologySize,
} from "@/panels/topology-layout";
import type { Theme } from "@/styles/theme";
import {
  describeLiveActivity,
  formatTokenCount,
  summarizeChildProgress,
  type ChildProgress,
} from "@/panels/topology-overview";
import {
  AGENT_TRACK_STATES,
  AGENT_TRACK_STATE_LABELS,
  agentTrackStateOf,
  buildActivityFeed,
  countTrackStates,
  matchesTrackFilter,
  sortForTracking,
  toggleTrackFilter,
  trackStateSince,
  type AgentTrackFilter,
  type ActivityEntry,
  type AgentTrackState,
} from "@/panels/topology-tracking";
import { useSessionStore } from "@/stores/session-store";
import { formatCompactTimeAgo, formatCompactTimeAgoAsProse } from "@/utils/time";

interface FlowNodeData extends Record<string, unknown> {
  topologyNode: TopologyNode;
  /** Host whose session store holds this agent's live timeline; null when the host has none. */
  serverId: string | null;
  /** 1-based position among its parent's children, in creation order; null for a root. */
  ordinal: number | null;
  /** How the agent's delegated work stands, or null for an agent with no children. */
  childProgress: ChildProgress | null;
  /** Lines the title gets; the card height was computed from it. */
  titleLines: 1 | 2;
  /** Outside the active status filter: drawn faded so the matching cards stand out. */
  dimmed: boolean;
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
  dimmed: boolean;
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
.tp-root { position: absolute; inset: 0; overflow: hidden; display: flex; flex-direction: column; background: var(--tp-bg); font-family: inherit; }
.tp-canvas { position: relative; flex: 1; min-height: 0; background: radial-gradient(ellipse at 50% 40%, color-mix(in srgb, var(--tp-surface) 55%, transparent), transparent 70%); }
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
  position: relative; width: 100%; height: 100%; box-sizing: border-box; padding: 13px 14px 12px;
  display: flex; flex-direction: column;
  border: 1px solid var(--tp-border); border-radius: 14px; overflow: hidden;
  background: linear-gradient(180deg, color-mix(in srgb, var(--tp-role) 7%, var(--tp-surface)), var(--tp-surface) 56px);
  box-shadow: 0 1px 0 color-mix(in srgb, var(--tp-fg) 4%, transparent) inset, 0 10px 28px -14px rgba(0, 0, 0, .45);
  transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease, transform .15s ease;
  animation: tp-enter .3s ease-out both;
}
[data-role="supervisor"] { --tp-role: var(--tp-role-supervisor); }
[data-role="lead"] { --tp-role: var(--tp-role-lead); }
[data-role="peer"] { --tp-role: var(--tp-role-peer); }
.tp-node::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 2px; background: linear-gradient(90deg, var(--tp-role), color-mix(in srgb, var(--tp-role) 0%, transparent) 80%); }
.tp-node:hover { border-color: var(--tp-border-strong); transform: translateY(-1px); }
.tp-node[data-status="running"], .tp-node[data-status="initializing"] { border-color: color-mix(in srgb, var(--tp-status) 38%, var(--tp-border)); box-shadow: 0 0 0 1px color-mix(in srgb, var(--tp-status) 10%, transparent), 0 10px 32px -12px color-mix(in srgb, var(--tp-status) 35%, transparent); }
.tp-node[data-status="error"] { border-color: color-mix(in srgb, var(--tp-status) 45%, var(--tp-border)); }
.tp-node[data-selected="true"] { border-color: color-mix(in srgb, var(--tp-role) 60%, var(--tp-border)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--tp-role) 16%, transparent); }
.tp-node[data-status="closed"] { opacity: .55; }

.tp-head { display: flex; align-items: center; gap: 7px; height: 22px; flex: none; }
.tp-role-icon { color: var(--tp-role); display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 7px; background: color-mix(in srgb, var(--tp-role) 15%, transparent); }
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

.tp-node[data-dimmed="true"] { opacity: .28; filter: saturate(.3); }
.tp-node[data-dimmed="true"]:hover { opacity: .6; }
.tp-title { flex: none; margin-top: 10px; max-height: 38px; color: var(--tp-fg); font-size: 13.5px; font-weight: 500; line-height: 19px; letter-spacing: -.005em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
.tp-title[data-lines="1"] { max-height: 19px; -webkit-line-clamp: 1; }
.tp-meta { flex: none; margin-top: 4px; height: 16px; line-height: 16px; font-size: 11.5px; color: var(--tp-fg-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-meta-sep { color: var(--tp-fg-faint); padding: 0 5px; }
.tp-meta-faint { color: var(--tp-fg-faint); }

.tp-task, .tp-detail { flex: none; display: flex; align-items: center; gap: 6px; height: 18px; line-height: 18px; font-size: 11.5px; color: var(--tp-fg-muted); min-width: 0; }
.tp-task { margin-top: 10px; color: var(--tp-fg); }
.tp-detail { margin-top: 4px; }
.tp-task-icon { flex: none; display: flex; color: var(--tp-fg-faint); }
.tp-task-lead { flex: none; font-variant-numeric: tabular-nums; }
.tp-task-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-task[data-tone="running"] .tp-task-icon, .tp-task[data-tone="running"] .tp-task-lead { color: var(--tp-st-running); }
.tp-task[data-tone="running"] .tp-task-text { font-family: ${MONO}; font-size: 11px; }
.tp-task[data-tone="warning"] { color: var(--tp-st-warning); }
.tp-task[data-tone="warning"] .tp-task-icon { color: var(--tp-st-warning); }
.tp-task[data-tone="danger"] { color: var(--tp-st-danger); }
.tp-task[data-tone="danger"] .tp-task-icon { color: var(--tp-st-danger); }
.tp-task[data-tone="success"] .tp-task-icon { color: var(--tp-st-success); }
.tp-task[data-tone="faint"] { color: var(--tp-fg-faint); }
.tp-progress-bar { flex: 1; min-width: 40px; display: flex; gap: 3px; }
.tp-progress-seg { flex: 1; height: 4px; border-radius: 2px; background: var(--tp-st-success); }
.tp-progress-seg[data-state="running"] { background: var(--tp-st-running); animation: tp-breathe 1.6s ease-in-out infinite; }
.tp-progress-seg[data-state="needs-you"] { background: var(--tp-st-warning); }
.tp-progress-text { flex: none; white-space: nowrap; font-variant-numeric: tabular-nums; }
.tp-progress-text b { color: var(--tp-fg); font-weight: 500; }
.tp-foot { flex: none; margin-top: auto; height: 28px; box-sizing: border-box; padding-top: 9px; border-top: 1px solid var(--tp-border); display: flex; align-items: center; gap: 6px; font-size: 11px; line-height: 18px; color: var(--tp-fg-muted); min-width: 0; }
.tp-foot-icon { flex: none; display: flex; color: var(--tp-fg-faint); }
.tp-foot-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-foot-count { color: var(--tp-fg); }
.tp-foot-status { flex: none; white-space: nowrap; color: var(--tp-fg-faint); }
.tp-foot-status[data-issue-status="in_progress"] { color: var(--tp-st-running); }
.tp-foot-status[data-issue-status="blocked"] { color: var(--tp-st-danger); }
.tp-foot[data-tone="running"] .tp-foot-icon, .tp-foot[data-tone="running"] .tp-foot-lead { color: var(--tp-st-running); }
.tp-foot[data-tone="warning"] .tp-foot-icon, .tp-foot[data-tone="warning"] .tp-foot-lead { color: var(--tp-st-warning); }
.tp-foot[data-tone="danger"] .tp-foot-icon, .tp-foot[data-tone="danger"] .tp-foot-lead { color: var(--tp-st-danger); }
.tp-foot[data-tone="faint"] .tp-foot-text { color: var(--tp-fg-faint); }
.tp-foot-lead { font-variant-numeric: tabular-nums; }
.tp-foot b { color: var(--tp-fg); font-weight: 500; }
.tp-foot-sep { color: var(--tp-fg-faint); }
.tp-foot-id { flex: none; color: var(--tp-fg-faint); font-family: ${MONO}; font-size: 10.5px; }

.tp-edge { stroke: var(--tp-edge); stroke-width: 1.5; stroke-opacity: .6; fill: none; }
.tp-edge-port { fill: var(--tp-bg); stroke: var(--tp-edge); stroke-width: 1.5; }
.tp-edge-flow { stroke: var(--tp-edge); stroke-width: 2; stroke-opacity: .9; fill: none; stroke-linecap: round; stroke-dasharray: 1 9; animation: tp-flow 1.2s linear infinite; pointer-events: none; }
g[data-dimmed="true"] { opacity: .2; }
[data-kind="supervision"] { --tp-edge: var(--tp-role-supervisor); }
[data-kind="delegation"] { --tp-edge: var(--tp-role-lead); }

.tp-hud { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; min-height: 44px; box-sizing: border-box; padding: 8px 14px; border-bottom: 1px solid var(--tp-border); background: color-mix(in srgb, var(--tp-surface) 70%, var(--tp-bg)); }
.tp-hud-title { display: flex; align-items: center; gap: 8px; min-width: 0; color: var(--tp-fg); font-size: 13px; font-weight: 500; }
.tp-hud-title > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-hud-title > svg { color: var(--tp-fg-muted); flex: none; }
.tp-hud-group { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; }
.tp-hud-spacer { flex: 1; }
.tp-hud-chip { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 9px; border-radius: 999px; font-size: 11.5px; color: var(--tp-fg-muted); background: var(--tp-surface-hover); white-space: nowrap; font-variant-numeric: tabular-nums; }
.tp-hud-chip b { color: var(--tp-fg); font-weight: 500; }
.tp-hud-chip[data-tone="running"] { color: var(--tp-st-running); background: color-mix(in srgb, var(--tp-st-running) 14%, transparent); }
.tp-hud-chip[data-tone="running"] b { color: inherit; }
.tp-hud-chip[data-tone="warning"] { color: var(--tp-st-warning); background: color-mix(in srgb, var(--tp-st-warning) 14%, transparent); }
.tp-hud-activity-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.tp-hud-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; }
.tp-hud-legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--tp-fg-faint); white-space: nowrap; }
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

.tp-ov-head { display: flex; flex-direction: column; gap: 10px; }
.tp-ov-summary { display: flex; flex-wrap: wrap; gap: 6px; }
.tp-ov-chip { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: 999px; font-size: 11.5px; color: var(--tp-fg-muted); background: var(--tp-surface-hover); white-space: nowrap; font-variant-numeric: tabular-nums; }
.tp-ov-chip b { color: var(--tp-fg); font-weight: 500; }
.tp-ov-chip[data-state] { color: var(--tp-ov); background: color-mix(in srgb, var(--tp-ov) 13%, transparent); }
.tp-ov-chip[data-state] b { color: inherit; }
.tp-ov-chip[data-state="inactive"] { color: var(--tp-fg-muted); background: var(--tp-surface-hover); }
.tp-ov-section-title { display: flex; align-items: center; gap: 8px; color: var(--tp-fg-muted); font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
.tp-ov-list { display: flex; flex-direction: column; gap: 8px; }
.tp-ov-item, .tp-inbox-row {
  --tp-ov: var(--tp-fg-faint);
  position: relative; overflow: hidden; border: 1px solid var(--tp-border); border-radius: 14px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--tp-ov) 7%, var(--tp-surface)), var(--tp-surface) 220px);
  box-shadow: 0 1px 0 color-mix(in srgb, var(--tp-fg) 4%, transparent) inset, 0 8px 24px -16px rgba(0, 0, 0, .45);
  transition: border-color .15s ease, box-shadow .15s ease;
}
.tp-ov-item::before, .tp-inbox-row::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--tp-ov); opacity: .9; }
.tp-ov-item:hover, .tp-inbox-row:hover { border-color: var(--tp-border-strong); }
.tp-ov-item[data-state="working"] { border-color: color-mix(in srgb, var(--tp-ov) 30%, var(--tp-border)); box-shadow: 0 0 0 1px color-mix(in srgb, var(--tp-ov) 8%, transparent), 0 10px 30px -16px color-mix(in srgb, var(--tp-ov) 40%, transparent); }
.tp-ov-item[data-state="needs-you"], .tp-inbox-row[data-state="needs-you"] { border-color: color-mix(in srgb, var(--tp-ov) 35%, var(--tp-border)); }
.tp-ov-item[data-state="inactive"]::before { opacity: .4; }
.tp-ov-row { display: grid; grid-template-columns: minmax(0, 1fr) auto 56px 16px; align-items: center; gap: 16px; padding: 14px 16px 14px 18px; cursor: pointer; outline: none; }
.tp-ov-row:focus-visible { box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--tp-ov) 55%, transparent); border-radius: 14px; }
.tp-ov-state { display: inline-flex; align-items: center; gap: 5px; flex: none; justify-self: start; height: 20px; padding: 0 8px; border-radius: 999px; font-size: 11px; white-space: nowrap; color: var(--tp-ov); background: color-mix(in srgb, var(--tp-ov) 14%, transparent); }
.tp-ov-state-dot { position: relative; width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: none; }
.tp-ov-state[data-state="working"] .tp-ov-state-dot::after { content: ""; position: absolute; inset: -3px; border-radius: 50%; border: 1px solid currentColor; animation: tp-ping 1.8s ease-out infinite; }
[data-state="needs-you"] { --tp-ov: var(--tp-st-danger); }
[data-state="working"] { --tp-ov: var(--tp-st-running); }
[data-state="review"] { --tp-ov: var(--tp-st-warning); }
[data-state="idle"] { --tp-ov: var(--tp-st-success); }
[data-state="inactive"] { --tp-ov: var(--tp-fg-faint); }
.tp-ov-state[data-state="inactive"] { color: var(--tp-fg-muted); background: var(--tp-surface-hover); }
.tp-ov-main { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.tp-ov-title-line { display: flex; align-items: center; gap: 8px; min-width: 0; }
.tp-ov-name { min-width: 0; color: var(--tp-fg); font-size: 14px; font-weight: 500; letter-spacing: -.005em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-ov-focus { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 12px; color: var(--tp-fg-muted); white-space: nowrap; overflow: hidden; }
.tp-ov-agent { display: inline-flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; text-overflow: ellipsis; border-radius: 4px; }
.tp-ov-agent + .tp-ov-agent::before { content: "·"; color: var(--tp-fg-faint); margin-right: 1px; }
.tp-ov-agent:hover .tp-ov-agent-title { color: var(--tp-fg); text-decoration: underline; text-underline-offset: 2px; }
.tp-ov-agent-role { flex: none; height: 16px; line-height: 16px; padding: 0 5px; border-radius: 4px; color: var(--tp-role); background: color-mix(in srgb, var(--tp-role) 14%, transparent); font-size: 9.5px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
.tp-ov-agent-title { overflow: hidden; text-overflow: ellipsis; }
.tp-ov-more { flex: none; color: var(--tp-fg-faint); }
.tp-ov-counts { display: flex; gap: 6px; font-size: 11.5px; color: var(--tp-fg-muted); white-space: nowrap; }
.tp-ov-count { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: 999px; background: var(--tp-surface-hover); font-variant-numeric: tabular-nums; }
.tp-ov-counts b { color: var(--tp-fg); font-weight: 500; }
.tp-ov-count[data-tone] { color: var(--tp-tone); background: color-mix(in srgb, var(--tp-tone) 13%, transparent); }
.tp-ov-count[data-tone] b { color: inherit; }
.tp-ov-count[data-tone="danger"] { --tp-tone: var(--tp-st-danger); }
.tp-ov-count[data-tone="running"] { --tp-tone: var(--tp-st-running); }
.tp-ov-count[data-tone="warning"] { --tp-tone: var(--tp-st-warning); }
.tp-ov-time { justify-self: end; font-size: 11.5px; color: var(--tp-fg-faint); white-space: nowrap; font-variant-numeric: tabular-nums; }
.tp-ov-chevron { color: var(--tp-fg-faint); display: flex; transition: transform .15s ease, color .15s ease; }
.tp-ov-row:hover .tp-ov-chevron, .tp-inbox-row:hover .tp-ov-chevron { color: var(--tp-fg); }
.tp-ov-row[aria-expanded="true"] .tp-ov-chevron, .tp-ov-group[aria-expanded="true"] .tp-ov-chevron { transform: rotate(90deg); }
.tp-ov-graph { position: relative; border-top: 1px solid var(--tp-border); background: var(--tp-bg); }
.tp-ov-focus[data-live] { flex-direction: column; align-items: stretch; gap: 4px; }
.tp-ov-focus[data-live] .tp-ov-agent + .tp-ov-agent::before { content: none; }
.tp-ov-activity { display: inline-flex; flex: 0 1 auto; align-items: center; gap: 6px; min-width: 6.5ch; color: var(--tp-fg-faint); }
.tp-ov-focus[data-live] .tp-ov-agent { max-width: 100%; }
.tp-ov-focus[data-live] .tp-ov-agent-title { flex: 0 1 auto; min-width: 4ch; }
.tp-ov-activity::before { content: "—"; flex: none; }
.tp-ov-activity-label { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--tp-fg-muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
.tp-ov-activity-time { flex: none; color: var(--tp-st-running); font-variant-numeric: tabular-nums; }
.tp-inbox { display: flex; flex-direction: column; gap: 10px; }
.tp-inbox-count { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; font-size: 11px; letter-spacing: 0; color: var(--tp-st-danger); background: color-mix(in srgb, var(--tp-st-danger) 14%, transparent); }
.tp-inbox-row { display: grid; grid-template-columns: minmax(0, 1fr) auto 16px; align-items: center; gap: 16px; padding: 12px 16px 12px 18px; cursor: pointer; outline: none; }
.tp-inbox-row:focus-visible { box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--tp-ov) 55%, transparent); }
.tp-inbox-agent { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 12.5px; color: var(--tp-fg); white-space: nowrap; overflow: hidden; }
.tp-inbox-project { flex: none; color: var(--tp-fg-muted); }
.tp-inbox-project::after { content: "›"; margin-left: 8px; color: var(--tp-fg-faint); }
.tp-inbox-detail { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; color: var(--tp-fg-muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.tp-ov-group { display: flex; align-items: center; gap: 8px; padding: 0 2px; color: var(--tp-fg-muted); font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; cursor: pointer; user-select: none; }
.tp-ov-group:hover { color: var(--tp-fg); }
@container tp-page (max-width: 640px) {
  .tp-ov-row { grid-template-columns: minmax(0, 1fr) auto 16px; row-gap: 10px; }
  .tp-ov-main { grid-column: 1; grid-row: 1; }
  .tp-ov-time { grid-column: 2; grid-row: 1; align-self: start; }
  .tp-ov-chevron { grid-column: 3; grid-row: 1; align-self: start; }
  .tp-ov-counts { grid-column: 1 / -1; grid-row: 2; flex-wrap: wrap; }
}

.tp-body { position: relative; flex: 1; min-height: 0; display: flex; container: tp-body / inline-size; }
.tp-main { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; }
.tp-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; }
.tp-filter { --tp-ov: var(--tp-fg-muted); display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: 999px; border: 1px solid transparent; font: inherit; font-size: 11.5px; color: var(--tp-fg-muted); background: var(--tp-surface-hover); white-space: nowrap; font-variant-numeric: tabular-nums; cursor: pointer; transition: background-color .15s ease, border-color .15s ease, color .15s ease; }
.tp-filter:hover { color: var(--tp-fg); }
.tp-filter:focus-visible { outline: 2px solid color-mix(in srgb, var(--tp-ov) 60%, transparent); outline-offset: 1px; }
.tp-filter b { color: var(--tp-fg); font-weight: 500; }
.tp-filter[data-state] { color: var(--tp-ov); }
.tp-filter[data-state] b { color: inherit; }
.tp-filter[aria-pressed="true"] { background: color-mix(in srgb, var(--tp-ov) 16%, transparent); border-color: color-mix(in srgb, var(--tp-ov) 45%, transparent); }
.tp-filter[data-state="closed"] { --tp-ov: var(--tp-fg-faint); }
.tp-filter-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: none; }
.tp-filter[data-state="working"] .tp-filter-dot { position: relative; }
.tp-filter[data-state="working"] .tp-filter-dot::after { content: ""; position: absolute; inset: -3px; border-radius: 50%; border: 1px solid currentColor; animation: tp-ping 1.8s ease-out infinite; }
.tp-filter-clear { font: inherit; font-size: 11.5px; color: var(--tp-fg-faint); background: none; border: 0; padding: 0 4px; cursor: pointer; }
.tp-filter-clear:hover { color: var(--tp-fg); text-decoration: underline; text-underline-offset: 2px; }
.tp-seg { display: inline-flex; padding: 2px; gap: 2px; border-radius: 8px; background: var(--tp-surface-hover); }
.tp-seg-btn { display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 8px; border: 0; border-radius: 6px; font: inherit; font-size: 11.5px; color: var(--tp-fg-muted); background: transparent; cursor: pointer; }
.tp-seg-btn:hover { color: var(--tp-fg); }
.tp-seg-btn[aria-pressed="true"] { color: var(--tp-fg); background: var(--tp-surface); box-shadow: 0 1px 2px rgba(0,0,0,.25); }
.tp-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border: 0; border-radius: 6px; color: var(--tp-fg-muted); background: transparent; cursor: pointer; }
.tp-icon-btn:hover { color: var(--tp-fg); background: var(--tp-surface-hover); }
.tp-icon-btn[aria-pressed="true"] { color: var(--tp-fg); }

.tp-list { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 16px 24px; display: flex; flex-direction: column; gap: 18px; }
.tp-list-group { display: flex; flex-direction: column; gap: 6px; }
.tp-list-group-title { display: flex; align-items: center; gap: 8px; padding: 0 2px 2px; color: var(--tp-fg-muted); font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
.tp-list-group-title > span { color: var(--tp-fg-faint); font-weight: 500; letter-spacing: 0; }
.tp-row { --tp-ov: var(--tp-fg-faint); position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto 16px; align-items: center; gap: 14px; padding: 10px 14px 10px 16px; border: 1px solid var(--tp-border); border-radius: 12px; background: var(--tp-surface); cursor: pointer; outline: none; overflow: hidden; transition: border-color .15s ease, background-color .15s ease; }
.tp-row::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--tp-ov); }
.tp-row:hover { border-color: var(--tp-border-strong); background: color-mix(in srgb, var(--tp-surface-hover) 50%, var(--tp-surface)); }
.tp-row:focus-visible { box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--tp-ov) 55%, transparent); }
.tp-row[data-state="closed"] { opacity: .6; }
.tp-row-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.tp-row-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.tp-row-name { min-width: 0; color: var(--tp-fg); font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-row-model { flex: none; font-size: 11.5px; color: var(--tp-fg-faint); white-space: nowrap; }
.tp-row .tp-task { margin-top: 0; }
.tp-row-time { justify-self: end; font-size: 11.5px; color: var(--tp-fg-faint); white-space: nowrap; font-variant-numeric: tabular-nums; }
.tp-row-chevron { color: var(--tp-fg-faint); display: flex; }
.tp-row:hover .tp-row-chevron { color: var(--tp-fg); }
.tp-empty { margin: auto; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px; color: var(--tp-fg-muted); font-size: 12.5px; text-align: center; }

.tp-rail { flex: none; width: 288px; min-height: 0; display: flex; flex-direction: column; border-left: 1px solid var(--tp-border); background: color-mix(in srgb, var(--tp-surface) 45%, var(--tp-bg)); }
.tp-rail-head { flex: none; display: flex; align-items: center; justify-content: space-between; height: 40px; padding: 0 8px 0 14px; border-bottom: 1px solid var(--tp-border); color: var(--tp-fg-muted); font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
.tp-rail-list { flex: 1; min-height: 0; overflow-y: auto; padding: 6px 0 16px; }
.tp-event { --tp-ov: var(--tp-fg-faint); position: relative; display: grid; grid-template-columns: 14px minmax(0, 1fr); gap: 8px; padding: 9px 14px; cursor: pointer; outline: none; }
.tp-event:hover { background: var(--tp-surface-hover); }
.tp-event:focus-visible { box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--tp-ov) 55%, transparent); }
.tp-event::after { content: ""; position: absolute; left: 20px; top: 24px; bottom: -9px; width: 1px; background: var(--tp-border); }
.tp-event:last-child::after { display: none; }
.tp-event-dot { margin-top: 5px; width: 8px; height: 8px; border-radius: 50%; background: var(--tp-ov); box-shadow: 0 0 0 3px color-mix(in srgb, var(--tp-ov) 18%, transparent); justify-self: center; position: relative; z-index: 1; }
.tp-event-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; font-size: 12px; line-height: 17px; color: var(--tp-fg-muted); }
.tp-event-who { color: var(--tp-fg); font-weight: 500; }
.tp-event-role { color: var(--tp-role); font-size: 9.5px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; margin-right: 6px; }
.tp-event-detail { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: var(--tp-fg-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-event-time { font-size: 11px; color: var(--tp-fg-faint); font-variant-numeric: tabular-nums; }
.tp-row[data-state="needs-you"], .tp-event[data-state="needs-you"] { --tp-ov: var(--tp-st-danger); }
.tp-row[data-state="working"], .tp-event[data-state="working"], .tp-filter[data-state="working"] { --tp-ov: var(--tp-st-running); }
.tp-row[data-state="review"], .tp-event[data-state="review"], .tp-filter[data-state="review"] { --tp-ov: var(--tp-st-warning); }
.tp-row[data-state="idle"], .tp-event[data-state="idle"], .tp-filter[data-state="idle"] { --tp-ov: var(--tp-st-success); }
.tp-filter[data-state="needs-you"] { --tp-ov: var(--tp-st-danger); }
.tp-rail-toggle { display: inline-flex; }
@container tp-body (max-width: 560px) {
  .tp-rail { display: none; }
}

@keyframes tp-enter { from { opacity: 0; } to { opacity: 1; } }
@keyframes tp-ping { from { transform: scale(.6); opacity: .8; } to { transform: scale(2); opacity: 0; } }
@keyframes tp-flow { to { stroke-dashoffset: -20; } }
@keyframes tp-breathe { 50% { opacity: .35; } }
@media (prefers-reduced-motion: reduce) {
  .tp-node, .tp-edge-flow, .tp-progress-seg, .tp-dot::after, .tp-ov-state-dot::after, .tp-filter-dot::after { animation: none !important; }
  .tp-node:hover { transform: none; }
}
`;

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

type CardTone = "running" | "warning" | "danger" | "success" | "faint";

/** What the agent is doing or waiting on right now, in one line. */
function describeCardTask(
  node: TopologyNode,
  liveLabel: string | null,
  now: Date,
): {
  tone: CardTone;
  icon: ComponentType<{ color: string; size: number }>;
  lead: string | null;
  text: string;
} {
  if (node.pendingPermission) {
    return { tone: "warning", icon: ShieldQuestion, lead: "Waiting", text: node.pendingPermission };
  }
  if (node.status === "error") {
    return { tone: "danger", icon: TriangleAlert, lead: "Error", text: node.lastError ?? "" };
  }
  if (isActiveStatus(node.status)) {
    const elapsed = node.turnStartedAt ? formatCompactTimeAgo(node.turnStartedAt, now) : null;
    return {
      tone: "running",
      icon: Activity,
      lead: elapsed === "now" ? "<1m" : elapsed,
      text: node.status === "initializing" ? "Starting" : (liveLabel ?? "Working"),
    };
  }
  if (node.status === "closed") {
    return { tone: "faint", icon: CircleCheck, lead: null, text: "Closed" };
  }
  if (node.requiresAttention && node.attentionReason === "finished") {
    return { tone: "success", icon: CircleCheck, lead: null, text: "Finished, ready to review" };
  }
  return { tone: "faint", icon: Clock, lead: null, text: "Waiting for instructions" };
}

/** The newest step of a running agent's turn, read from this client's copy of its timeline. */
function useLiveActivityLabel(serverId: string | null, node: TopologyNode): string | null {
  const live = serverId !== null && isActiveStatus(node.status);
  const tail = useSessionStore((state) =>
    live ? state.sessions[serverId]?.agentStreamTail.get(node.id) : undefined,
  );
  return useMemo(
    () => describeLiveActivity(tail, node.turnStartedAt)?.label ?? null,
    [node.turnStartedAt, tail],
  );
}

function CardTask({ data, now }: { data: FlowNodeData; now: Date }) {
  const node = data.topologyNode;
  const liveLabel = useLiveActivityLabel(data.serverId, node);
  const task = describeCardTask(node, liveLabel, now);
  const Icon = task.icon;
  return (
    <div className="tp-task" data-tone={task.tone} title={task.text}>
      <span className="tp-task-icon">
        <Icon color="currentColor" size={12} />
      </span>
      {task.lead ? <span className="tp-task-lead">{task.lead}</span> : null}
      <span className="tp-task-text">{task.text}</span>
    </div>
  );
}

function CardProgress({ progress }: { progress: ChildProgress }) {
  const total = progress.children.length;
  const extras = [
    progress.needsYou > 0 ? `${progress.needsYou} need you` : null,
    progress.running > 0 ? `${progress.running} running` : null,
  ].filter(Boolean);
  const text = `${progress.done}/${total} done${extras.length > 0 ? ` · ${extras.join(" · ")}` : ""}`;
  return (
    <div className="tp-detail" title={text}>
      <span className="tp-progress-bar" aria-hidden="true">
        {progress.children.map((child) => (
          <span key={child.id} className="tp-progress-seg" data-state={child.state} />
        ))}
      </span>
      <span className="tp-progress-text">
        <b>
          {progress.done}/{total}
        </b>{" "}
        done
        {extras.length > 0 ? ` · ${extras.join(" · ")}` : null}
      </span>
    </div>
  );
}

function CardIssue({ issues }: { issues: FlowNodeData["issues"] }) {
  const issue = issues[0];
  if (!issue) return null;
  const count = issues.length;
  const hasTitle = issue.title !== issue.id;
  return (
    <div className="tp-detail" title={hasTitle ? issue.title : undefined}>
      <span className="tp-task-icon">
        <CircleDot color="currentColor" size={12} />
      </span>
      <span className="tp-task-text">
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

function CardFooter({ node, now }: { node: TopologyNode; now: Date }) {
  const lastActive =
    !isActiveStatus(node.status) && node.lastActivityAt
      ? `Active ${formatCompactTimeAgoAsProse(formatCompactTimeAgo(node.lastActivityAt, now))}`
      : null;
  const tokens = node.contextTokens;
  return (
    <div className="tp-foot">
      <span className="tp-foot-text">
        {tokens !== null ? (
          <span title="Tokens in the agent's context window">
            <b>{formatTokenCount(tokens)}</b> tokens
          </span>
        ) : null}
        {tokens !== null && lastActive ? <span className="tp-foot-sep"> · </span> : null}
        {lastActive}
      </span>
      <span className="tp-foot-id">{node.shortId}</span>
    </div>
  );
}

function AgentTopologyNode({ data, selected }: NodeProps<FlowNode>) {
  const node = data.topologyNode;
  const now = useMinuteClock();
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
      data-dimmed={data.dimmed ? "true" : undefined}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <div className="tp-head">
        <span className="tp-role-icon">
          <RoleIcon color="currentColor" size={12} />
        </span>
        <span className="tp-role-label">
          {TOPOLOGY_ROLE_META[node.role].label}
          {data.ordinal !== null ? ` ${data.ordinal}` : null}
        </span>
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
      <div className="tp-title" data-lines={data.titleLines} title={node.title}>
        {node.title}
      </div>
      <div className="tp-meta" title={routeTitle}>
        {modelName}
        <span className="tp-meta-sep">·</span>
        <span className="tp-meta-faint">{profileName ?? providerName}</span>
      </div>
      <CardTask data={data} now={now} />
      {data.childProgress ? (
        <CardProgress progress={data.childProgress} />
      ) : (
        <CardIssue issues={data.issues} />
      )}
      <CardFooter node={node} now={now} />
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
    <g data-kind={kind} data-dimmed={data?.dimmed ? "true" : undefined}>
      <BaseEdge path={path} className="tp-edge" />
      {data?.active ? <path d={path} className="tp-edge-flow" /> : null}
      <circle cx={sourceX} cy={sourceY} r={3} className="tp-edge-port" />
      <circle cx={targetX} cy={targetY} r={3} className="tp-edge-port" />
    </g>
  );
}

const NODE_TYPES = { agent: AgentTopologyNode };
const EDGE_TYPES = { relationship: RelationshipEdge };
const FIT_VIEW_OPTIONS = { padding: 0.14, minZoom: 0.2, maxZoom: 1.1 };
const PACKED_COLUMNS = 4;

interface SizedTopologyNode {
  id: string;
  height: number;
  titleLines: 1 | 2;
}

/** Size each card from what it will show, so idle cards carry no empty band. */
function sizeTopologyNodes(
  nodes: readonly TopologyNode[],
  progress: ReadonlyMap<string, ChildProgress>,
): SizedTopologyNode[] {
  return nodes.map((node) => {
    const titleLines = topologyTitleLines(node.title);
    const hasDetail = progress.has(node.id) || node.issueIds.length > 0;
    return { id: node.id, titleLines, height: topologyCardHeight({ titleLines, hasDetail }) };
  });
}

function layoutTopology(
  nodes: readonly SizedTopologyNode[],
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
    if (!initialized) return;
    lastSizeRef.current = size;
    // The first real size after a hidden or zero-size mount: the earlier fit read
    // stale dimensions, so fit again unless the user already moved the view.
    if (!previous) {
      if (!userMovedRef.current) void fitView(FIT_VIEW_OPTIONS);
      return;
    }
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
  serverId: string | null,
  filter: AgentTrackFilter,
): FlowNode[] {
  const { ordinals, progress } = summarizeChildren(nodes, edges);
  const sized = sizeTopologyNodes(nodes, progress);
  const sizeById = new Map(sized.map((entry) => [entry.id, entry]));
  const boxes = layoutTopology(sized, edges, packed);
  return nodes.map((node) => {
    const box = boxes.get(node.id);
    const size = sizeById.get(node.id);
    const height =
      box?.height ?? size?.height ?? topologyCardHeight({ titleLines: 2, hasDetail: true });
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
        serverId,
        ordinal: ordinals.get(node.id) ?? null,
        childProgress: progress.get(node.id) ?? null,
        titleLines: size?.titleLines ?? 2,
        dimmed: !matchesTrackFilter(node, filter),
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
): { ordinals: Map<string, number>; progress: Map<string, ChildProgress> } {
  const nodeOrder = new Map(nodes.map((node, index) => [node.id, index]));
  const childrenByParent = new Map<string, TopologyNode[]>();
  for (const edge of edges) {
    const childIndex = nodeOrder.get(edge.target);
    if (childIndex === undefined || !nodeOrder.has(edge.source)) continue;
    childrenByParent.set(edge.source, [
      ...(childrenByParent.get(edge.source) ?? []),
      nodes[childIndex],
    ]);
  }
  const ordinals = new Map<string, number>();
  const progress = new Map<string, ChildProgress>();
  for (const [parentId, children] of childrenByParent) {
    // Nodes arrive in creation order, so sorting by it numbers children as they were delegated.
    const ordered = [...children].sort(
      (left, right) => (nodeOrder.get(left.id) ?? 0) - (nodeOrder.get(right.id) ?? 0),
    );
    ordered.forEach((child, index) => ordinals.set(child.id, index + 1));
    progress.set(parentId, summarizeChildProgress(ordered));
  }
  return { ordinals, progress };
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

export type TopologyView = "graph" | "list";

/** The panel's tracking controls; the embedded overview graph has none. */
interface TopologyTracking {
  nodes: readonly TopologyNode[];
  ordinals: ReadonlyMap<string, number>;
  filter: AgentTrackFilter;
  onToggleFilter: (state: AgentTrackState) => void;
  onClearFilter: () => void;
  view: TopologyView;
  onViewChange: (view: TopologyView) => void;
  railOpen: boolean;
  onToggleRail: () => void;
}

function TrackFilterChip({
  state,
  count,
  pressed,
  onToggle,
}: {
  state: AgentTrackState;
  count: number;
  pressed: boolean;
  onToggle: (state: AgentTrackState) => void;
}) {
  const handleClick = useCallback(() => onToggle(state), [onToggle, state]);
  const label = AGENT_TRACK_STATE_LABELS[state];
  return (
    <button
      type="button"
      className="tp-filter"
      data-state={state}
      aria-pressed={pressed}
      title={pressed ? `Stop filtering by ${label}` : `Show only ${label}`}
      onClick={handleClick}
    >
      <span className="tp-filter-dot" />
      <b>{count}</b>
      {label}
    </button>
  );
}

function TrackFilters({ tracking }: { tracking: TopologyTracking }) {
  const counts = useMemo(() => countTrackStates(tracking.nodes), [tracking.nodes]);
  const shown = AGENT_TRACK_STATES.filter((state) => counts[state] > 0);
  return (
    <div className="tp-filters" role="group" aria-label="Filter agents by state">
      {shown.map((state) => (
        <TrackFilterChip
          key={state}
          state={state}
          count={counts[state]}
          pressed={tracking.filter.has(state)}
          onToggle={tracking.onToggleFilter}
        />
      ))}
      {tracking.filter.size > 0 ? (
        <button type="button" className="tp-filter-clear" onClick={tracking.onClearFilter}>
          Show all
        </button>
      ) : null}
    </div>
  );
}

function ViewButton({
  view,
  current,
  onChange,
  children,
}: {
  view: TopologyView;
  current: TopologyView;
  onChange: (view: TopologyView) => void;
  children: ReactNode;
}) {
  const handleClick = useCallback(() => onChange(view), [onChange, view]);
  return (
    <button
      type="button"
      className="tp-seg-btn"
      aria-pressed={current === view}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}

function TopologyHud({ hud, tracking }: { hud: TopologyHudProps; tracking: TopologyTracking }) {
  const {
    projectName,
    agentCount,
    edgeCount,
    roleCounts,
    edgeKinds,
    warningCount,
    grantedIssueCount,
    issuesLoading,
    issuesUnavailable,
  } = hud;
  const roleTitle = TOPOLOGY_ROLE_ORDER.filter((role) => roleCounts[role] > 0)
    .map(
      (role) =>
        `${roleCounts[role]} ${roleCounts[role] === 1 ? TOPOLOGY_ROLE_META[role].label : TOPOLOGY_ROLE_META[role].plural}`,
    )
    .join(" · ");
  return (
    <div className="tp-hud" aria-label={`${projectName} topology summary`}>
      <div
        className="tp-hud-title"
        title={`${pluralize(agentCount, "agent")} · ${pluralize(edgeCount, "relationship")}${
          roleTitle ? `\n${roleTitle}` : ""
        }`}
      >
        <Network color="currentColor" size={14} />
        <span>{projectName}</span>
      </div>
      <TrackFilters tracking={tracking} />
      {grantedIssueCount > 0 ? (
        <span className="tp-hud-chip">
          <CircleDot color="currentColor" size={11} />
          <b>{issuesLoading ? "–" : grantedIssueCount}</b>
          {grantedIssueCount === 1 ? "issue" : "issues"}
        </span>
      ) : null}
      {warningCount > 0 ? (
        <span className="tp-hud-chip" data-tone="warning">
          {pluralize(warningCount, "relationship")} need review
        </span>
      ) : null}
      {issuesUnavailable && grantedIssueCount > 0 ? (
        <span className="tp-hud-chip" data-tone="warning">
          Issue details unavailable
        </span>
      ) : null}
      <span className="tp-hud-spacer" />
      {tracking.view === "graph" && edgeKinds.length > 0 ? (
        <div className="tp-hud-legend">
          {edgeKinds.map((kind) => (
            <span key={kind} className="tp-hud-legend-item" data-kind={kind}>
              <span className="tp-line" />
              {kind === "delegation" ? "Delegates" : "Supervises"}
            </span>
          ))}
        </div>
      ) : null}
      <div className="tp-seg" role="group" aria-label="View">
        <ViewButton view="graph" current={tracking.view} onChange={tracking.onViewChange}>
          <Waypoints color="currentColor" size={12} />
          Graph
        </ViewButton>
        <ViewButton view="list" current={tracking.view} onChange={tracking.onViewChange}>
          <LayoutList color="currentColor" size={12} />
          List
        </ViewButton>
      </div>
      <button
        type="button"
        className="tp-icon-btn tp-rail-toggle"
        aria-pressed={tracking.railOpen}
        aria-label={tracking.railOpen ? "Hide activity" : "Show activity"}
        title={tracking.railOpen ? "Hide activity" : "Show activity"}
        onClick={tracking.onToggleRail}
      >
        {tracking.railOpen ? (
          <PanelRightClose color="currentColor" size={14} />
        ) : (
          <PanelRightOpen color="currentColor" size={14} />
        )}
      </button>
    </div>
  );
}

function roleLabelOf(node: TopologyNode, ordinals: ReadonlyMap<string, number>): string {
  const ordinal = ordinals.get(node.id);
  return `${TOPOLOGY_ROLE_META[node.role].label}${ordinal !== undefined ? ` ${ordinal}` : ""}`;
}

/** Click and Enter/Space handlers for a row that opens one agent. */
function useOpenAgentHandlers(agentId: string, onOpenAgent: (agentId: string) => void) {
  const onClick = useCallback(() => onOpenAgent(agentId), [agentId, onOpenAgent]);
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onOpenAgent(agentId);
    },
    [agentId, onOpenAgent],
  );
  return { onClick, onKeyDown };
}

function TopologyListRow({
  node,
  ordinals,
  serverId,
  now,
  onOpenAgent,
}: {
  node: TopologyNode;
  ordinals: ReadonlyMap<string, number>;
  serverId: string | null;
  now: Date;
  onOpenAgent: (agentId: string) => void;
}) {
  const state = agentTrackStateOf(node);
  const liveLabel = useLiveActivityLabel(serverId, node);
  const task = describeCardTask(node, liveLabel, now);
  const TaskIcon = task.icon;
  const since = trackStateSince(node);
  const { onClick, onKeyDown } = useOpenAgentHandlers(node.id, onOpenAgent);
  const modelName = formatTopologyModelName(node.model) ?? "Default model";
  return (
    <div
      className="tp-row"
      role="button"
      tabIndex={0}
      data-state={state}
      data-testid={`topology-row-${node.id}`}
      aria-label={`Open ${node.title}, ${AGENT_TRACK_STATE_LABELS[state]}`}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <div className="tp-row-main">
        <div className="tp-row-title" data-role={node.role}>
          <span className="tp-ov-agent-role">{roleLabelOf(node, ordinals)}</span>
          <span className="tp-row-name" title={node.title}>
            {node.title}
          </span>
          <span className="tp-row-model">{modelName}</span>
        </div>
        <div className="tp-task" data-tone={task.tone} title={task.text}>
          <span className="tp-task-icon">
            <TaskIcon color="currentColor" size={12} />
          </span>
          {task.lead ? <span className="tp-task-lead">{task.lead}</span> : null}
          <span className="tp-task-text">{task.text}</span>
        </div>
      </div>
      <span className="tp-row-time">{since ? formatCompactTimeAgo(since, now) : ""}</span>
      <span className="tp-row-chevron">
        <ChevronRight color="currentColor" size={14} />
      </span>
    </div>
  );
}

function TopologyList({
  tracking,
  serverId,
  onOpenAgent,
}: {
  tracking: TopologyTracking;
  serverId: string | null;
  onOpenAgent: (agentId: string) => void;
}) {
  const now = useMinuteClock();
  const groups = useMemo(() => {
    const visible = sortForTracking(
      tracking.nodes.filter((node) => matchesTrackFilter(node, tracking.filter)),
    );
    return AGENT_TRACK_STATES.map((state) => ({
      state,
      nodes: visible.filter((node) => agentTrackStateOf(node) === state),
    })).filter((group) => group.nodes.length > 0);
  }, [tracking.filter, tracking.nodes]);
  if (groups.length === 0) {
    return (
      <div className="tp-list">
        <div className="tp-empty">No agents match this filter.</div>
      </div>
    );
  }
  return (
    <div className="tp-list" data-testid="topology-list">
      {groups.map((group) => (
        <section key={group.state} className="tp-list-group">
          <div className="tp-list-group-title">
            {AGENT_TRACK_STATE_LABELS[group.state]}
            <span>{group.nodes.length}</span>
          </div>
          {group.nodes.map((node) => (
            <TopologyListRow
              key={node.id}
              node={node}
              ordinals={tracking.ordinals}
              serverId={serverId}
              now={now}
              onOpenAgent={onOpenAgent}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function ActivityEvent({
  entry,
  ordinals,
  now,
  onOpenAgent,
}: {
  entry: ActivityEntry;
  ordinals: ReadonlyMap<string, number>;
  now: Date;
  onOpenAgent: (agentId: string) => void;
}) {
  const { onClick, onKeyDown } = useOpenAgentHandlers(entry.node.id, onOpenAgent);
  return (
    <div
      className="tp-event"
      role="button"
      tabIndex={0}
      data-state={entry.state}
      onClick={onClick}
      onKeyDown={onKeyDown}
      title={entry.node.title}
    >
      <span className="tp-event-dot" />
      <div className="tp-event-body">
        <span>
          <span className="tp-event-role" data-role={entry.node.role}>
            {roleLabelOf(entry.node, ordinals)}
          </span>
          <span className="tp-event-who">{entry.node.title}</span> {entry.verb}
        </span>
        {entry.detail ? <span className="tp-event-detail">{entry.detail}</span> : null}
        <span className="tp-event-time">
          {formatCompactTimeAgoAsProse(formatCompactTimeAgo(entry.at, now))}
        </span>
      </div>
    </div>
  );
}

function ActivityRail({
  tracking,
  onOpenAgent,
}: {
  tracking: TopologyTracking;
  onOpenAgent: (agentId: string) => void;
}) {
  const now = useMinuteClock();
  const feed = useMemo(
    () =>
      buildActivityFeed(tracking.nodes.filter((node) => matchesTrackFilter(node, tracking.filter))),
    [tracking.filter, tracking.nodes],
  );
  return (
    <aside className="tp-rail" aria-label="Latest activity" data-testid="topology-activity">
      <div className="tp-rail-head">
        Latest activity
        <button
          type="button"
          className="tp-icon-btn"
          aria-label="Hide activity"
          title="Hide activity"
          onClick={tracking.onToggleRail}
        >
          <PanelRightClose color="currentColor" size={14} />
        </button>
      </div>
      <div className="tp-rail-list">
        {feed.length === 0 ? <div className="tp-empty">No activity yet.</div> : null}
        {feed.map((entry) => (
          <ActivityEvent
            key={entry.node.id}
            entry={entry}
            ordinals={tracking.ordinals}
            now={now}
            onOpenAgent={onOpenAgent}
          />
        ))}
      </div>
    </aside>
  );
}

interface TopologyCanvasProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  hud: TopologyHudProps | null;
  tracking: TopologyTracking | null;
  serverId: string | null;
  embedded: boolean;
  testID?: string;
  onOpenAgent: (agentId: string) => void;
  themeVars?: CSSProperties;
  colorScheme?: "light" | "dark";
  dotColor?: string;
}

function TopologyFlow({
  nodes,
  edges,
  embedded,
  onOpenAgent,
  colorScheme,
  dotColor,
}: Pick<
  TopologyCanvasProps,
  "nodes" | "edges" | "embedded" | "onOpenAgent" | "colorScheme" | "dotColor"
>) {
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
    <div className="tp-canvas">
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
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color={dotColor} />
        <Controls
          position="bottom-right"
          showInteractive={false}
          fitViewOptions={FIT_VIEW_OPTIONS}
        />
      </ReactFlow>
    </div>
  );
}

function TopologyCanvas({
  nodes,
  edges,
  hud,
  tracking,
  serverId,
  embedded,
  testID,
  onOpenAgent,
  themeVars,
  colorScheme,
  dotColor,
}: TopologyCanvasProps) {
  const flow = (
    <TopologyFlow
      nodes={nodes}
      edges={edges}
      embedded={embedded}
      onOpenAgent={onOpenAgent}
      colorScheme={colorScheme}
      dotColor={dotColor}
    />
  );
  return (
    <div className="tp-root" style={themeVars} data-testid={testID}>
      <style>{TOPOLOGY_CSS}</style>
      {hud && tracking ? <TopologyHud hud={hud} tracking={tracking} /> : null}
      {tracking ? (
        <div className="tp-body">
          <div className="tp-main">
            {tracking.view === "list" ? (
              <TopologyList tracking={tracking} serverId={serverId} onOpenAgent={onOpenAgent} />
            ) : (
              flow
            )}
          </div>
          {tracking.railOpen ? (
            <ActivityRail tracking={tracking} onOpenAgent={onOpenAgent} />
          ) : null}
        </div>
      ) : (
        flow
      )}
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
  const { progress } = summarizeChildren(nodes, edges);
  for (const box of layoutTopology(sizeTopologyNodes(nodes, progress), edges, true).values()) {
    width = Math.max(width, box.x + box.width);
    height = Math.max(height, box.y + box.height);
  }
  return { width, height };
}

export interface TopologyGraphProps {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  issueById?: ReadonlyMap<string, BeadsIssue>;
  /** Host the agents run on; lets running cards show their live step. */
  serverId?: string | null;
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
  serverId = null,
  hud = null,
  embedded = false,
  testID,
  onOpenAgent,
}: TopologyGraphProps) {
  const [filter, setFilter] = useState<AgentTrackFilter>(() => new Set());
  const [view, setView] = useState<TopologyView>("graph");
  const [railOpen, setRailOpen] = useState(true);
  const toggleFilter = useCallback(
    (state: AgentTrackState) => setFilter((current) => toggleTrackFilter(current, state)),
    [],
  );
  const clearFilter = useCallback(() => setFilter(new Set()), []);
  const toggleRail = useCallback(() => setRailOpen((open) => !open), []);
  const ordinals = useMemo(() => summarizeChildren(nodes, edges).ordinals, [edges, nodes]);
  // Only the panel tracks; the embedded overview graph stays a plain picture.
  const tracking = useMemo<TopologyTracking | null>(
    () =>
      hud
        ? {
            nodes,
            ordinals,
            filter,
            onToggleFilter: toggleFilter,
            onClearFilter: clearFilter,
            view,
            onViewChange: setView,
            railOpen,
            onToggleRail: toggleRail,
          }
        : null,
    [clearFilter, filter, hud, nodes, ordinals, railOpen, toggleFilter, toggleRail, view],
  );
  const flowEdges = useMemo<FlowEdge[]>(() => {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const dimmedOf = (id: string) => {
      const node = byId.get(id);
      return node ? !matchesTrackFilter(node, filter) : false;
    };
    return edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "relationship",
      data: {
        kind: edge.kind,
        active: isActiveStatus(byId.get(edge.target)?.status),
        dimmed: dimmedOf(edge.source) || dimmedOf(edge.target),
      },
      selectable: false,
    }));
  }, [edges, filter, nodes]);
  const flowNodes = useMemo(
    () => toFlowNodes(nodes, edges, issueById, embedded, serverId, filter),
    [edges, embedded, filter, issueById, nodes, serverId],
  );
  return (
    <ThemedTopologyCanvas
      nodes={flowNodes}
      edges={flowEdges}
      hud={hud}
      tracking={tracking}
      serverId={serverId}
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
