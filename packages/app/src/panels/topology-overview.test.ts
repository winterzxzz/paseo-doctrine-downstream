import { describe, expect, it } from "vitest";
import type { TopologyNode } from "@/panels/topology-model";
import {
  buildAttentionInbox,
  compareProjectOverviews,
  describeLiveActivity,
  formatTokenCount,
  summarizeChildProgress,
  summarizeProject,
} from "@/panels/topology-overview";
import type { StreamItem } from "@/types/stream";

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
    turnStartedAt: null,
    attentionAt: null,
    pendingPermission: null,
    lastError: null,
    issueIds: [],
    contextTokens: null,
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

describe("buildAttentionInbox", () => {
  it("lists permission requests, then errors, then unread finished work, longest wait first", () => {
    const project = (id: string, nodes: TopologyNode[]) => ({
      id,
      label: id,
      overview: summarizeProject(nodes),
    });
    const inbox = buildAttentionInbox([
      project("alpha", [
        node("done", { requiresAttention: true, attentionReason: "finished", attentionAt: at(1) }),
        node("late-ask", {
          requiresAttention: true,
          attentionReason: "permission",
          attentionAt: at(8),
          pendingPermission: "Run npm test",
        }),
      ]),
      project("beta", [
        node("broken", { status: "error", lastError: "exit 1", attentionAt: at(2) }),
        node("early-ask", {
          role: "peer",
          requiresAttention: true,
          attentionReason: "permission",
          attentionAt: at(3),
        }),
        node("busy", { status: "running" }),
      ]),
    ]);
    expect(inbox.map((item) => [item.node.id, item.reason, item.projectLabel])).toEqual([
      ["early-ask", "permission", "beta"],
      ["late-ask", "permission", "alpha"],
      ["broken", "error", "beta"],
      ["done", "finished", "alpha"],
    ]);
    expect(inbox[1].detail).toBe("Run npm test");
    expect(inbox[2].detail).toBe("exit 1");
  });
});

describe("describeLiveActivity", () => {
  const shell = (minute: number, command: string): StreamItem => ({
    kind: "tool_call",
    id: `tool-${minute}`,
    timestamp: at(minute),
    payload: {
      source: "agent",
      data: {
        provider: "claude",
        callId: `call-${minute}`,
        name: "Bash",
        status: "running",
        error: null,
        detail: { type: "shell", command },
      },
    },
  });

  it("names the newest tool call of the current turn", () => {
    const activity = describeLiveActivity([shell(2, "ls"), shell(5, "npm test")], at(1));
    expect(activity).toEqual({ label: "Shell npm test", at: at(5) });
  });

  it("shows nothing when the client holds no step of the current turn", () => {
    expect(describeLiveActivity([shell(2, "ls")], at(4))).toBeNull();
    expect(describeLiveActivity(undefined, at(4))).toBeNull();
  });
});

describe("summarizeChildProgress", () => {
  it("counts each delegated agent as done, running, or needing the Human", () => {
    const progress = summarizeChildProgress([
      node("closed", { role: "peer", status: "closed" }),
      node("finished", {
        role: "peer",
        requiresAttention: true,
        attentionReason: "finished",
      }),
      node("asking", {
        role: "peer",
        requiresAttention: true,
        attentionReason: "permission",
        pendingPermission: "git push",
      }),
      node("working", { role: "peer", status: "running" }),
      node("broken", { role: "peer", status: "error" }),
    ]);
    expect(progress.children.map((child) => child.state)).toEqual([
      "done",
      "done",
      "needs-you",
      "running",
      "needs-you",
    ]);
    expect(progress).toMatchObject({ done: 2, running: 1, needsYou: 2 });
  });
});

describe("formatTokenCount", () => {
  it("abbreviates thousands and millions", () => {
    expect(formatTokenCount(950)).toBe("950");
    expect(formatTokenCount(8_400)).toBe("8.4k");
    expect(formatTokenCount(84_200)).toBe("84k");
    expect(formatTokenCount(1_000_000)).toBe("1M");
    expect(formatTokenCount(1_260_000)).toBe("1.3M");
  });
});
