import type { TopologyNode } from "@/panels/topology-model";

/**
 * One state per agent, most urgent first. It mirrors the project-level states in
 * topology-overview.ts so a project row and its agents read the same way.
 */
export type AgentTrackState = "needs-you" | "working" | "review" | "idle" | "closed";

export const AGENT_TRACK_STATES: AgentTrackState[] = [
  "needs-you",
  "working",
  "review",
  "idle",
  "closed",
];

export const AGENT_TRACK_STATE_LABELS: Record<AgentTrackState, string> = {
  "needs-you": "Needs you",
  working: "Working",
  review: "To review",
  idle: "Idle",
  closed: "Closed",
};

export function agentTrackStateOf(node: TopologyNode): AgentTrackState {
  if (node.status === "closed") return "closed";
  if (
    node.status === "error" ||
    node.pendingPermission !== null ||
    (node.requiresAttention &&
      (node.attentionReason === "permission" || node.attentionReason === "error"))
  ) {
    return "needs-you";
  }
  if (node.status === "running" || node.status === "initializing") return "working";
  if (node.requiresAttention && node.attentionReason === "finished") return "review";
  return "idle";
}

/** A filter is the set of states to show; empty means show everything. */
export type AgentTrackFilter = ReadonlySet<AgentTrackState>;

export function matchesTrackFilter(node: TopologyNode, filter: AgentTrackFilter): boolean {
  return filter.size === 0 || filter.has(agentTrackStateOf(node));
}

export function countTrackStates(nodes: readonly TopologyNode[]): Record<AgentTrackState, number> {
  const counts: Record<AgentTrackState, number> = {
    "needs-you": 0,
    working: 0,
    review: 0,
    idle: 0,
    closed: 0,
  };
  for (const node of nodes) counts[agentTrackStateOf(node)] += 1;
  return counts;
}

/** Toggle one state in a filter, returning a new set. */
export function toggleTrackFilter(
  filter: AgentTrackFilter,
  state: AgentTrackState,
): Set<AgentTrackState> {
  const next = new Set(filter);
  if (next.has(state)) next.delete(state);
  else next.add(state);
  return next;
}

/** The moment that best explains an agent's current state. */
export function trackStateSince(node: TopologyNode): Date | null {
  const state = agentTrackStateOf(node);
  if (state === "needs-you" || state === "review") return node.attentionAt ?? node.lastActivityAt;
  if (state === "working") return node.turnStartedAt ?? node.lastActivityAt;
  return node.lastActivityAt;
}

/** List order: most urgent state first; within a state, the most recent change first. */
export function sortForTracking(nodes: readonly TopologyNode[]): TopologyNode[] {
  return [...nodes].sort(
    (left, right) =>
      AGENT_TRACK_STATES.indexOf(agentTrackStateOf(left)) -
        AGENT_TRACK_STATES.indexOf(agentTrackStateOf(right)) ||
      (trackStateSince(right)?.getTime() ?? 0) - (trackStateSince(left)?.getTime() ?? 0),
  );
}

export interface ActivityEntry {
  node: TopologyNode;
  state: AgentTrackState;
  at: Date;
  /** What happened, as a short sentence fragment: "asked for permission", "started a turn". */
  verb: string;
  /** The permission asked for or the error text, when there is one. */
  detail: string | null;
}

function describeActivity(
  node: TopologyNode,
  state: AgentTrackState,
): Omit<ActivityEntry, "node" | "state" | "at"> {
  switch (state) {
    case "needs-you":
      if (node.status === "error" || node.attentionReason === "error") {
        return { verb: "hit an error", detail: node.lastError };
      }
      return { verb: "asked for permission", detail: node.pendingPermission };
    case "working":
      return {
        verb: node.status === "initializing" ? "is starting" : "started a turn",
        detail: null,
      };
    case "review":
      return { verb: "finished, ready to review", detail: null };
    case "closed":
      return { verb: "was closed", detail: null };
    case "idle":
      return { verb: "went idle", detail: null };
  }
}

/**
 * Each agent's latest change, newest first. The client holds each agent's current
 * state, not a history, so this is one entry per agent rather than an event log.
 */
export function buildActivityFeed(nodes: readonly TopologyNode[], limit = 30): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  for (const node of nodes) {
    const at = trackStateSince(node);
    if (!at) continue;
    const state = agentTrackStateOf(node);
    entries.push({ node, state, at, ...describeActivity(node, state) });
  }
  return entries.sort((left, right) => right.at.getTime() - left.at.getTime()).slice(0, limit);
}
