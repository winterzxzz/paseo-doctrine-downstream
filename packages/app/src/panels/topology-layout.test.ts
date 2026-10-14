import { describe, expect, it } from "vitest";
import type { TopologyNode } from "@/panels/topology-model";
import {
  isDeliberateViewportChange,
  layoutProjectTopologyPacked,
  layoutProjectTopologyXFirst,
  recenterTopologyViewport,
  topologyViewportShowsAnyBox,
  type TopologyBox,
} from "@/panels/topology-layout";

function roleFromId(id: string): TopologyNode["role"] {
  if (id.startsWith("peer")) return "peer";
  if (id.startsWith("supervisor")) return "supervisor";
  return "lead";
}

function node(id: string, overrides: Partial<TopologyNode> = {}): TopologyNode {
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
    ...overrides,
  };
}

function expectNoOverlap(boxes: Map<string, TopologyBox>) {
  const entries = [...boxes.entries()];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const [leftId, a] = entries[i];
      const [rightId, b] = entries[j];
      const separated =
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y;
      expect(separated, `${leftId} overlaps ${rightId}`).toBe(true);
    }
  }
}

function center(box: TopologyBox | undefined): number {
  return box ? box.y + box.height / 2 : Number.NaN;
}

describe("layoutProjectTopologyXFirst", () => {
  it("places a few Peer siblings at one depth in a single column", () => {
    const nodes = [node("lead"), node("peer-1"), node("peer-2"), node("peer-3")];
    const boxes = layoutProjectTopologyXFirst(nodes, [
      { source: "lead", target: "peer-1" },
      { source: "lead", target: "peer-2" },
      { source: "lead", target: "peer-3" },
    ]);

    const peerXs = ["peer-1", "peer-2", "peer-3"].map((id) => boxes.get(id)?.x);
    expect(new Set(peerXs).size).toBe(1);
    expect(peerXs[0]).toBeGreaterThan(
      (boxes.get("lead")?.x ?? 0) + (boxes.get("lead")?.width ?? 0),
    );
    const peerYs = ["peer-1", "peer-2", "peer-3"].map((id) => boxes.get(id)?.y ?? 0);
    expect(peerYs).toEqual([...peerYs].sort((a, b) => a - b));
    expect(center(boxes.get("lead"))).toBeCloseTo(center(boxes.get("peer-2")));
    expectNoOverlap(boxes);
  });

  it("keeps Supervisor, Lead and Peer ordered from left to right", () => {
    const boxes = layoutProjectTopologyXFirst(
      [node("supervisor"), node("lead"), node("peer-1")],
      [
        { source: "supervisor", target: "lead" },
        { source: "lead", target: "peer-1" },
      ],
    );

    expect(boxes.get("supervisor")?.x).toBeLessThan(boxes.get("lead")?.x ?? 0);
    expect(boxes.get("lead")?.x).toBeLessThan(boxes.get("peer-1")?.x ?? 0);
  });

  it("keeps disconnected relationship trees in separate bands", () => {
    const boxes = layoutProjectTopologyXFirst(
      [node("lead-a"), node("peer-a"), node("lead-b"), node("peer-b")],
      [
        { source: "lead-a", target: "peer-a" },
        { source: "lead-b", target: "peer-b" },
      ],
    );

    expect(center(boxes.get("lead-a"))).toBeCloseTo(center(boxes.get("peer-a")));
    expect(center(boxes.get("lead-b"))).toBeCloseTo(center(boxes.get("peer-b")));
    const peerA = boxes.get("peer-a");
    expect(boxes.get("lead-b")?.y ?? 0).toBeGreaterThan((peerA?.y ?? 0) + (peerA?.height ?? 0));
    expectNoOverlap(boxes);
  });

  it("centers a parent on its children", () => {
    const boxes = layoutProjectTopologyXFirst(
      [node("supervisor"), node("lead"), node("peer-1"), node("peer-2")],
      [
        { source: "supervisor", target: "lead" },
        { source: "lead", target: "peer-1" },
        { source: "lead", target: "peer-2" },
      ],
    );

    const childrenCenter = (center(boxes.get("peer-1")) + center(boxes.get("peer-2"))) / 2;
    expect(center(boxes.get("lead"))).toBeCloseTo(childrenCenter);
    expect(center(boxes.get("supervisor"))).toBeCloseTo(childrenCenter);
    expectNoOverlap(boxes);
  });

  it("wraps one Lead's 12 Peers into a grid without overlap", () => {
    const peers = Array.from({ length: 12 }, (_, index) =>
      node(`peer-${index}`, {
        issueIds: index % 3 === 0 ? ["paseo-1", "paseo-2", "paseo-3"] : [],
        requiresAttention: index % 4 === 0,
        assignmentDisposition: index % 2 === 0 ? "in_progress" : null,
      }),
    );
    const boxes = layoutProjectTopologyXFirst(
      [node("lead"), ...peers],
      peers.map((peer) => ({ source: "lead", target: peer.id })),
    );

    expect(boxes.size).toBe(13);
    const peerXs = new Set(peers.map((peer) => boxes.get(peer.id)?.x));
    expect(peerXs.size).toBe(3);
    for (const x of peerXs) expect(x).toBeGreaterThan(boxes.get("lead")?.x ?? 0);
    expectNoOverlap(boxes);
  });

  it("keeps three Leads with mixed Peers under a Supervisor apart", () => {
    const leads = [
      { id: "lead-a", peers: 1 },
      { id: "lead-b", peers: 9 },
      { id: "lead-c", peers: 4 },
    ];
    const nodes = [node("supervisor", { issueIds: ["paseo-9"] })];
    const edges: { source: string; target: string }[] = [];
    for (const lead of leads) {
      nodes.push(node(lead.id, { issueIds: ["paseo-1", "paseo-2"], requiresAttention: true }));
      edges.push({ source: "supervisor", target: lead.id });
      for (let index = 0; index < lead.peers; index += 1) {
        const peerId = `peer-${lead.id}-${index}`;
        nodes.push(node(peerId, { issueIds: index % 2 === 0 ? ["paseo-3"] : [] }));
        edges.push({ source: lead.id, target: peerId });
      }
    }
    nodes.push(node("lead-solo"));

    const boxes = layoutProjectTopologyXFirst(nodes, edges);

    expect(boxes.size).toBe(nodes.length);
    expectNoOverlap(boxes);
  });

  it("gives taller cards to agents with more content", () => {
    const boxes = layoutProjectTopologyXFirst(
      [
        node("lead-plain"),
        node("lead-busy", { issueIds: ["a", "b", "c"], requiresAttention: true }),
      ],
      [],
    );

    expect(boxes.get("lead-busy")?.height ?? 0).toBeGreaterThan(
      boxes.get("lead-plain")?.height ?? 0,
    );
    expectNoOverlap(boxes);
  });

  it("places every node of a cycle exactly once", () => {
    const boxes = layoutProjectTopologyXFirst(
      [node("lead-a"), node("lead-b")],
      [
        { source: "lead-a", target: "lead-b" },
        { source: "lead-b", target: "lead-a" },
      ],
    );

    expect(boxes.size).toBe(2);
    expectNoOverlap(boxes);
  });
});

describe("layoutProjectTopologyPacked", () => {
  it("keeps relationship trees and packs unrelated agents into a grid below", () => {
    const boxes = layoutProjectTopologyPacked(
      [node("lead"), node("lead-solo-1"), node("peer-1"), node("lead-solo-2"), node("lead-solo-3")],
      [{ source: "lead", target: "peer-1" }],
      2,
    );
    const get = (id: string): TopologyBox => {
      const box = boxes.get(id);
      if (!box) throw new Error(`missing ${id}`);
      return box;
    };

    expect(get("lead").x).toBe(0);
    expect(get("peer-1").x).toBeGreaterThan(get("lead").x);
    expect(get("lead-solo-1").y).toBeGreaterThan(Math.max(get("lead").y, get("peer-1").y));
    expect(get("lead-solo-1").y).toBe(get("lead-solo-2").y);
    expect(get("lead-solo-1").x).toBe(0);
    expect(get("lead-solo-2").x).toBeGreaterThan(0);
    expect(get("lead-solo-3").x).toBe(0);
    expect(get("lead-solo-3").y).toBeGreaterThan(get("lead-solo-1").y);
    expectNoOverlap(boxes);
  });

  it("starts the grid at the top when nothing is related", () => {
    const boxes = layoutProjectTopologyPacked([node("lead-1"), node("lead-2")], [], 4);

    expect(boxes.get("lead-1")).toMatchObject({ x: 0, y: 0 });
    expect(boxes.get("lead-2")?.y).toBe(0);
    expectNoOverlap(boxes);
  });
});

describe("topology viewport helpers", () => {
  it("ignores click jitter but counts a real pan or zoom", () => {
    const start = { x: 100, y: 50, zoom: 1 };
    expect(isDeliberateViewportChange(start, { x: 102, y: 51, zoom: 1 })).toBe(false);
    expect(isDeliberateViewportChange(start, { x: 140, y: 50, zoom: 1 })).toBe(true);
    expect(isDeliberateViewportChange(start, { x: 100, y: 50, zoom: 0.9 })).toBe(true);
  });

  it("keeps the old center point centered when the pane narrows", () => {
    const before = { x: 400, y: 100, zoom: 1 };
    const from = { width: 1600, height: 900 };
    const to = { width: 800, height: 900 };
    const after = recenterTopologyViewport(before, from, to);
    // Canvas point at the old center maps to the new center.
    const canvasX = (from.width / 2 - before.x) / before.zoom;
    expect(canvasX * after.zoom + after.x).toBe(to.width / 2);
    expect(after).toEqual({ x: 0, y: 100, zoom: 1 });
  });

  it("detects a viewport that shows only the space between cards", () => {
    const boxes = [
      { x: 0, y: 0, width: 280, height: 200 },
      { x: 1200, y: 0, width: 280, height: 200 },
    ];
    const size = { width: 600, height: 400 };
    expect(topologyViewportShowsAnyBox(boxes, { x: -400, y: 0, zoom: 1 }, size)).toBe(false);
    expect(topologyViewportShowsAnyBox(boxes, { x: 0, y: 0, zoom: 1 }, size)).toBe(true);
    expect(topologyViewportShowsAnyBox(boxes, { x: -1000, y: 0, zoom: 1 }, size)).toBe(true);
  });
});
