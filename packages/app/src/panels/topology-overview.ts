import type { TopologyNode } from "@/panels/topology-model";

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
