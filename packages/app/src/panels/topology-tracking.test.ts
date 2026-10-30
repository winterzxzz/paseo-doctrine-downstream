import { describe, expect, it } from "vitest";
import type { TopologyNode } from "@/panels/topology-model";
import {
  agentTrackStateOf,
  buildActivityFeed,
  countTrackStates,
  matchesTrackFilter,
  sortForTracking,
  toggleTrackFilter,
} from "@/panels/topology-tracking";

function node(id: string, overrides: Partial<TopologyNode> = {}): TopologyNode {
  return {
    id,
    title: id,
    shortId: id.slice(0, 8),
    role: "peer",
    status: "idle",
    provider: "claude",
    model: null,
    modeId: null,
    assignmentDisposition: null,
    launchProfile: null,
    workspaceId: null,
    requiresAttention: false,
    attentionReason: null,
    lastActivityAt: null,
    turnStartedAt: null,
    attentionAt: null,
    pendingPermission: null,
    lastError: null,
    issueIds: [],
    contextTokens: null,
    ...overrides,
  };
}

const at = (minute: number) => new Date(`2026-10-30T10:${String(minute).padStart(2, "0")}:00Z`);

describe("agentTrackStateOf", () => {
  it("puts a blocked agent ahead of everything else", () => {
    expect(agentTrackStateOf(node("a", { status: "running", pendingPermission: "Run git" }))).toBe(
      "needs-you",
    );
    expect(agentTrackStateOf(node("b", { status: "error" }))).toBe("needs-you");
  });

  it("separates running, finished-unreviewed, idle and closed agents", () => {
    expect(agentTrackStateOf(node("a", { status: "initializing" }))).toBe("working");
    expect(
      agentTrackStateOf(node("b", { requiresAttention: true, attentionReason: "finished" })),
    ).toBe("review");
    expect(agentTrackStateOf(node("c"))).toBe("idle");
    expect(agentTrackStateOf(node("d", { status: "closed", requiresAttention: true }))).toBe(
      "closed",
    );
  });
});

describe("filters", () => {
  it("shows everything when no state is selected", () => {
    expect(matchesTrackFilter(node("a"), new Set())).toBe(true);
  });

  it("shows only the selected states, and toggling twice clears the state", () => {
    const filter = toggleTrackFilter(new Set(), "working");
    expect(matchesTrackFilter(node("a", { status: "running" }), filter)).toBe(true);
    expect(matchesTrackFilter(node("b"), filter)).toBe(false);
    expect(toggleTrackFilter(filter, "working").size).toBe(0);
  });

  it("counts each agent once", () => {
    expect(
      countTrackStates([
        node("a", { status: "running" }),
        node("b", { status: "running", pendingPermission: "Edit file" }),
        node("c"),
      ]),
    ).toEqual({ "needs-you": 1, working: 1, review: 0, idle: 1, closed: 0 });
  });
});

describe("sortForTracking", () => {
  it("orders by urgency, then by the latest change", () => {
    const sorted = sortForTracking([
      node("idle-old", { lastActivityAt: at(1) }),
      node("running", { status: "running", turnStartedAt: at(2) }),
      node("idle-new", { lastActivityAt: at(5) }),
      node("blocked", { status: "error", attentionAt: at(0) }),
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual(["blocked", "running", "idle-new", "idle-old"]);
  });
});

describe("buildActivityFeed", () => {
  it("lists each agent's latest change, newest first, with the detail that explains it", () => {
    const feed = buildActivityFeed([
      node("idle", { lastActivityAt: at(1) }),
      node("asking", {
        status: "running",
        requiresAttention: true,
        attentionReason: "permission",
        pendingPermission: "Run npm test",
        attentionAt: at(9),
      }),
      node("never-active"),
      node("running", { status: "running", turnStartedAt: at(4) }),
    ]);
    expect(feed.map((entry) => [entry.node.id, entry.verb, entry.detail])).toEqual([
      ["asking", "asked for permission", "Run npm test"],
      ["running", "started a turn", null],
      ["idle", "went idle", null],
    ]);
  });

  it("caps the feed", () => {
    const nodes = Array.from({ length: 5 }, (_, index) =>
      node(`n${index}`, { lastActivityAt: at(index) }),
    );
    expect(buildActivityFeed(nodes, 2).map((entry) => entry.node.id)).toEqual(["n4", "n3"]);
  });
});
