import { describe, expect, it } from "vitest";
import type { TopologyNode } from "@/panels/topology-model";
import { compareProjectOverviews, summarizeProject } from "@/panels/topology-overview";

function node(id: string, overrides: Partial<TopologyNode> = {}): TopologyNode {
  return {
    id,
    title: id,
    shortId: id.slice(0, 8),
    role: "lead",
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
    issueIds: [],
    ...overrides,
  };
}

const at = (minute: number) => new Date(`2026-10-16T10:${String(minute).padStart(2, "0")}:00Z`);

describe("summarizeProject", () => {
  it("puts a permission request or error ahead of running work", () => {
    const overview = summarizeProject([
      node("peer", { role: "peer", status: "running" }),
      node("lead", { requiresAttention: true, attentionReason: "permission" }),
    ]);
    expect(overview.state).toBe("needs-you");
    expect(overview.focus.map((entry) => entry.id)).toEqual(["lead"]);
    expect(overview.running.map((entry) => entry.id)).toEqual(["peer"]);
  });

  it("names running Supervisors and Leads before Peers", () => {
    const overview = summarizeProject([
      node("peer", { role: "peer", status: "running", lastActivityAt: at(9) }),
      node("lead", { status: "running", lastActivityAt: at(1) }),
      node("sup", { role: "supervisor", status: "idle" }),
    ]);
    expect(overview.state).toBe("working");
    expect(overview.focus.map((entry) => entry.id)).toEqual(["lead", "peer"]);
    expect(overview.lastActivityAt).toEqual(at(9));
  });

  it("separates unread finished work, plain idle, and fully closed projects", () => {
    expect(
      summarizeProject([node("lead", { requiresAttention: true, attentionReason: "finished" })])
        .state,
    ).toBe("review");
    expect(summarizeProject([node("lead")]).state).toBe("idle");
    const closed = summarizeProject([node("lead", { status: "closed" })]);
    expect(closed.state).toBe("inactive");
    expect(closed.closedCount).toBe(1);
  });
});

describe("compareProjectOverviews", () => {
  it("orders by urgency, then recency", () => {
    const projects = [
      { label: "idle-new", overview: summarizeProject([node("a", { lastActivityAt: at(30) })]) },
      { label: "working", overview: summarizeProject([node("b", { status: "running" })]) },
      { label: "idle-old", overview: summarizeProject([node("c", { lastActivityAt: at(1) })]) },
    ];
    expect(projects.sort(compareProjectOverviews).map((project) => project.label)).toEqual([
      "working",
      "idle-new",
      "idle-old",
    ]);
  });
});
