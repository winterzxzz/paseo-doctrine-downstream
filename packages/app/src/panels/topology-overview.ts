import type { TopologyNode } from "@/panels/topology-model";
import type { StreamItem } from "@/types/stream";
import { describeToolCall } from "@/tool-calls/detail-level/grouping";
import { buildToolCallDisplayModel } from "@/utils/tool-call-display";

/** One project's state, most urgent first. */
export type ProjectActivityState = "needs-you" | "working" | "review" | "idle" | "inactive";

export const PROJECT_STATE_ORDER: ProjectActivityState[] = [
  "needs-you",
  "working",
  "review",
  "idle",
  "inactive",
];

export const PROJECT_STATE_LABELS: Record<ProjectActivityState, string> = {
  "needs-you": "Needs you",
  working: "Working",
  review: "To review",
  idle: "Idle",
  inactive: "Inactive",
};

export interface ProjectOverview {
  state: ProjectActivityState;
  /** Agents that block on the Human: a permission request or an error. */
  needsYou: TopologyNode[];
  running: TopologyNode[];
  /** Agents that finished and have not been looked at yet. */
  toReview: TopologyNode[];
  openCount: number;
  closedCount: number;
  lastActivityAt: Date | null;
  /** The agents worth naming on the overview row, most relevant first. */
  focus: TopologyNode[];
}

const ROLE_RANK: Record<TopologyNode["role"], number> = {
  supervisor: 0,
  lead: 1,
  peer: 2,
  unbound: 3,
};

function isRunning(node: TopologyNode): boolean {
  return node.status === "running" || node.status === "initializing";
}

function needsHuman(node: TopologyNode): boolean {
  if (node.status === "error") return true;
  return (
    node.requiresAttention &&
    (node.attentionReason === "permission" || node.attentionReason === "error")
  );
}

function isUnreviewed(node: TopologyNode): boolean {
  return node.requiresAttention && node.attentionReason === "finished";
}

function byRoleThenRecent(left: TopologyNode, right: TopologyNode): number {
  return (
    ROLE_RANK[left.role] - ROLE_RANK[right.role] ||
    (right.lastActivityAt?.getTime() ?? 0) - (left.lastActivityAt?.getTime() ?? 0)
  );
}

function byRecent(left: TopologyNode, right: TopologyNode): number {
  return (right.lastActivityAt?.getTime() ?? 0) - (left.lastActivityAt?.getTime() ?? 0);
}

export function summarizeProject(nodes: readonly TopologyNode[]): ProjectOverview {
  const open = nodes.filter((node) => node.status !== "closed");
  const needsYou = open.filter(needsHuman).sort(byRoleThenRecent);
  const running = open.filter(isRunning).sort(byRoleThenRecent);
  const toReview = open.filter((node) => !needsHuman(node) && isUnreviewed(node)).sort(byRecent);
  let lastActivityAt: Date | null = null;
  for (const node of nodes) {
    if (node.lastActivityAt && (!lastActivityAt || node.lastActivityAt > lastActivityAt)) {
      lastActivityAt = node.lastActivityAt;
    }
  }
  let state: ProjectActivityState;
  if (needsYou.length > 0) state = "needs-you";
  else if (running.length > 0) state = "working";
  else if (toReview.length > 0) state = "review";
  else if (open.length > 0) state = "idle";
  else state = "inactive";

  let focus: TopologyNode[];
  if (state === "needs-you") focus = needsYou;
  else if (state === "working") focus = running;
  else if (state === "review") focus = toReview;
  else {
    focus = [...(open.length > 0 ? open : nodes)]
      .sort(byRecent)
      .sort((left, right) => ROLE_RANK[left.role] - ROLE_RANK[right.role]);
  }

  return {
    state,
    needsYou,
    running,
    toReview,
    openCount: open.length,
    closedCount: nodes.length - open.length,
    lastActivityAt,
    focus: focus.slice(0, 2),
  };
}

/** Most urgent projects first; within a state, the most recently active first. */
export function compareProjectOverviews(
  left: { label: string; overview: ProjectOverview },
  right: { label: string; overview: ProjectOverview },
): number {
  return (
    PROJECT_STATE_ORDER.indexOf(left.overview.state) -
      PROJECT_STATE_ORDER.indexOf(right.overview.state) ||
    (right.overview.lastActivityAt?.getTime() ?? 0) -
      (left.overview.lastActivityAt?.getTime() ?? 0) ||
    left.label.localeCompare(right.label)
  );
}

export type AttentionReason = "permission" | "error" | "finished";

export const ATTENTION_REASON_LABELS: Record<AttentionReason, string> = {
  permission: "Permission",
  error: "Error",
  finished: "To review",
};

const ATTENTION_REASON_ORDER: AttentionReason[] = ["permission", "error", "finished"];

/** One agent waiting on the Human, across every project on the host. */
export interface AttentionItem {
  node: TopologyNode;
  projectId: string;
  projectLabel: string;
  reason: AttentionReason;
  /** When the wait began; the inbox shows how long it has lasted. */
  since: Date | null;
  /** The permission being asked for, or the error text. */
  detail: string | null;
}

function attentionReasonOf(node: TopologyNode): AttentionReason {
  if (node.status === "error" || node.attentionReason === "error") return "error";
  return node.attentionReason === "finished" ? "finished" : "permission";
}

/**
 * Everything that waits on the Human, most blocking first: permission requests, then errors,
 * then finished work nobody has looked at. Within a reason, the longest wait comes first.
 */
export function buildAttentionInbox(
  projects: readonly { id: string; label: string; overview: ProjectOverview }[],
): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const project of projects) {
    for (const node of [...project.overview.needsYou, ...project.overview.toReview]) {
      const reason = attentionReasonOf(node);
      let detail: string | null = null;
      if (reason === "permission") detail = node.pendingPermission;
      else if (reason === "error") detail = node.lastError;
      items.push({
        node,
        projectId: project.id,
        projectLabel: project.label,
        reason,
        since: node.attentionAt ?? node.lastActivityAt,
        detail,
      });
    }
  }
  return items.sort(
    (left, right) =>
      ATTENTION_REASON_ORDER.indexOf(left.reason) - ATTENTION_REASON_ORDER.indexOf(right.reason) ||
      (left.since?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (right.since?.getTime() ?? Number.MAX_SAFE_INTEGER),
  );
}

/** What a running agent is doing now, read from the part of its timeline this client holds. */
export interface AgentLiveActivity {
  label: string;
  at: Date;
}

/**
 * The newest step of the current turn: the tool it is calling, or that it is thinking or
 * writing. Null when this client holds none of the turn, so a stale step never shows as live.
 */
export function describeLiveActivity(
  tail: readonly StreamItem[] | undefined,
  turnStartedAt: Date | null,
): AgentLiveActivity | null {
  if (!tail) return null;
  for (let index = tail.length - 1; index >= 0; index -= 1) {
    const item = tail[index];
    if (turnStartedAt && item.timestamp < turnStartedAt) return null;
    if (item.kind === "thought") return { label: "Thinking", at: item.timestamp };
    if (item.kind === "assistant_message") return { label: "Writing", at: item.timestamp };
    if (item.kind !== "tool_call") continue;
    const call = describeToolCall(item);
    const display = buildToolCallDisplayModel({
      name: call.name,
      status: call.status === "executing" ? "running" : call.status,
      error: call.error ?? null,
      detail: call.detail,
      metadata: call.metadata,
    });
    const summary = display.summary?.trim();
    return {
      label: summary ? `${display.displayName} ${summary}` : display.displayName,
      at: item.timestamp,
    };
  }
  return null;
}

/** Where one delegated agent stands, as its parent's progress bar shows it. */
export type ChildWorkState = "needs-you" | "running" | "done";

export function childWorkStateOf(node: TopologyNode): ChildWorkState {
  if (needsHuman(node)) return "needs-you";
  if (isRunning(node)) return "running";
  return "done";
}

export interface ChildProgress {
  /** One entry per child, in the order the children were created. */
  children: { id: string; state: ChildWorkState }[];
  done: number;
  running: number;
  needsYou: number;
}

export function summarizeChildProgress(children: readonly TopologyNode[]): ChildProgress {
  const states = children.map(childWorkStateOf);
  return {
    children: children.map((child, index) => ({ id: child.id, state: states[index] })),
    done: states.filter((state) => state === "done").length,
    running: states.filter((state) => state === "running").length,
    needsYou: states.filter((state) => state === "needs-you").length,
  };
}

/** "950", "84k", "1.2M". */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1_000) return String(Math.round(tokens));
  if (tokens < 1_000_000) {
    const thousands = tokens / 1_000;
    return `${thousands < 10 ? thousands.toFixed(1).replace(/\.0$/, "") : Math.round(thousands)}k`;
  }
  const millions = tokens / 1_000_000;
  return `${millions < 10 ? millions.toFixed(1).replace(/\.0$/, "") : Math.round(millions)}M`;
}
