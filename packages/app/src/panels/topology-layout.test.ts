import { describe, expect, it } from "vitest";
import type { TopologyNode } from "@/panels/topology-model";
import { layoutProjectTopologyPacked, layoutProjectTopologyXFirst } from "@/panels/topology-layout";

function roleFromId(id: string): TopologyNode["role"] {
  if (id.startsWith("peer")) return "peer";
  if (id.startsWith("supervisor")) return "supervisor";
  return "lead";
}

function node(id: string): TopologyNode {
  return {
    id,
    title: id,
    shortId: id,
    role: roleFromId(id),
    status: "idle",
    provider: "codex",
    model: "test-model",
    modeId: "unattended",
    assignmentDisposition: null,
    launchProfile: null,
    workspaceId: "workspace-1",
    requiresAttention: false,
    issueIds: [],
  };
}

describe("layoutProjectTopologyXFirst", () => {
  it("places direct Peer siblings at one depth in separate lanes", () => {
    const nodes = [node("lead"), node("peer-1"), node("peer-2"), node("peer-3")];
    const positions = layoutProjectTopologyXFirst(nodes, [
      { source: "lead", target: "peer-1" },
      { source: "lead", target: "peer-2" },
      { source: "lead", target: "peer-3" },
    ]);

    expect(positions.get("lead")).toEqual({ x: 0, y: 235 });
    expect(["peer-1", "peer-2", "peer-3"].map((id) => positions.get(id)?.x)).toEqual([
      360, 360, 360,
    ]);
    expect(["peer-1", "peer-2", "peer-3"].map((id) => positions.get(id)?.y)).toEqual([0, 235, 470]);
  });

  it("keeps Supervisor, Lead and Peer ordered from left to right", () => {
    const positions = layoutProjectTopologyXFirst(
      [node("supervisor"), node("lead"), node("peer-1")],
      [
        { source: "supervisor", target: "lead" },
        { source: "lead", target: "peer-1" },
      ],
    );

    expect(positions.get("supervisor")?.x).toBeLessThan(positions.get("lead")?.x ?? 0);
    expect(positions.get("lead")?.x).toBeLessThan(positions.get("peer-1")?.x ?? 0);
  });

  it("keeps disconnected relationship trees in separate lane ranges", () => {
    const positions = layoutProjectTopologyXFirst(
      [node("lead-a"), node("peer-a"), node("lead-b"), node("peer-b")],
      [
        { source: "lead-a", target: "peer-a" },
        { source: "lead-b", target: "peer-b" },
      ],
    );

    expect(positions.get("lead-a")?.y).toBe(positions.get("peer-a")?.y);
    expect(positions.get("lead-b")?.y).toBe(positions.get("peer-b")?.y);
    expect(positions.get("lead-b")?.y ?? 0).toBeGreaterThan(positions.get("peer-a")?.y ?? 0);
  });

  it("keeps nested siblings aligned beneath their exact parent", () => {
    const positions = layoutProjectTopologyXFirst(
      [node("supervisor"), node("lead"), node("peer-1"), node("peer-2")],
      [
        { source: "supervisor", target: "lead" },
        { source: "lead", target: "peer-1" },
        { source: "lead", target: "peer-2" },
      ],
    );

    expect(positions.get("supervisor")).toEqual({ x: 0, y: 117.5 });
    expect(positions.get("lead")).toEqual({ x: 360, y: 117.5 });
    expect(positions.get("peer-1")).toEqual({ x: 720, y: 0 });
    expect(positions.get("peer-2")).toEqual({ x: 720, y: 235 });
  });
});

describe("layoutProjectTopologyPacked", () => {
  it("keeps relationship trees and packs unrelated agents into a grid below", () => {
    const positions = layoutProjectTopologyPacked(
      [node("lead"), node("lead-solo-1"), node("peer-1"), node("lead-solo-2"), node("lead-solo-3")],
      [{ source: "lead", target: "peer-1" }],
      2,
    );

    expect(positions.get("lead")).toEqual({ x: 0, y: 0 });
    expect(positions.get("peer-1")).toEqual({ x: 360, y: 0 });
    expect(positions.get("lead-solo-1")).toEqual({ x: 0, y: 235 });
    expect(positions.get("lead-solo-2")).toEqual({ x: 296, y: 235 });
    expect(positions.get("lead-solo-3")).toEqual({ x: 0, y: 470 });
  });

  it("starts the grid at the top when nothing is related", () => {
    const positions = layoutProjectTopologyPacked([node("lead-1"), node("lead-2")], [], 4);

    expect(positions.get("lead-1")).toEqual({ x: 0, y: 0 });
    expect(positions.get("lead-2")).toEqual({ x: 296, y: 0 });
  });
});
