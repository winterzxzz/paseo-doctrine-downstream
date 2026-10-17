import { beforeEach, describe, expect, it, vi } from "vitest";

const daemonTarget = { kind: "endpoint" as const, host: "example.test:12345" };

import { runDeleteCommand } from "./delete.js";

const agent = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "running",
  archivedAt: null as string | null,
  cwd: "/tmp/project",
};
const archivedAgent = {
  id: "22222222-2222-4222-8222-222222222222",
  status: "closed",
  archivedAt: "2026-10-01T00:00:00.000Z",
  cwd: "/tmp/project/nested",
};
const archivedOutsideAgent = {
  id: "33333333-3333-4333-8333-333333333333",
  status: "closed",
  archivedAt: "2026-10-01T00:00:00.000Z",
  cwd: "/tmp/elsewhere",
};
let daemonAgents: Array<typeof agent & { labels?: Record<string, string> }> = [agent];
const toEntry = (entry: typeof agent) => ({ agent: entry });
// The fake daemon pages history two agents at a time.
const historyPage = (cursor: string | undefined) => {
  const start = Number(cursor ?? 0);
  const end = start + 2;
  return {
    entries: daemonAgents.slice(start, end).map(toEntry),
    pageInfo: { nextCursor: end < daemonAgents.length ? String(end) : null },
  };
};
const cancelAgent = vi.fn(async () => {
  throw new Error("active run cancellation was not acknowledged");
});
const fetchAgentHistory = vi.fn(async (options: { page: { cursor?: string } }) =>
  historyPage(options.page.cursor),
);
const deleteAgent = vi.fn(async () => undefined);
const close = vi.fn(async () => undefined);
let serverFeatures: Record<string, boolean> = {};

vi.mock("../../utils/client.js", () => ({
  connectToDaemon: vi.fn(async () => ({
    fetchAgents: vi.fn(async () => historyPage(undefined)),
    fetchAgentHistory,
    fetchAgent: vi.fn(async () => ({ agent })),
    cancelAgent,
    deleteAgent,
    close,
    getLastServerInfoMessage: () => ({ features: serverFeatures }),
  })),
  getDaemonHost: vi.fn(() => "ws://127.0.0.1:6767"),
}));

describe("runDeleteCommand", () => {
  beforeEach(() => {
    daemonAgents = [agent];
    serverFeatures = {};
    deleteAgent.mockClear();
    fetchAgentHistory.mockClear();
  });

  it("force-deletes a running agent when graceful cancellation is refused", async () => {
    const result = await runDeleteCommand(agent.id, { daemonTarget }, {} as never);

    expect(fetchAgentHistory).not.toHaveBeenCalled();
    expect(cancelAgent).toHaveBeenCalledWith(agent.id);
    expect(deleteAgent).toHaveBeenCalledWith(agent.id);
    expect(result.data).toEqual({
      deletedCount: 1,
      agentIds: [agent.id],
    });
  });

  it("deletes archived agents on every history page with --all", async () => {
    daemonAgents = [agent, archivedAgent, archivedOutsideAgent];

    const result = await runDeleteCommand(undefined, { daemonTarget, all: true }, {} as never);

    expect(result.data).toEqual({
      deletedCount: 3,
      agentIds: [agent.id, archivedAgent.id, archivedOutsideAgent.id],
    });
  });

  it("deletes archived agents inside the directory with --cwd", async () => {
    daemonAgents = [agent, archivedAgent, archivedOutsideAgent];

    const result = await runDeleteCommand(
      undefined,
      { daemonTarget, cwd: "/tmp/project" },
      {} as never,
    );

    expect(result.data).toEqual({
      deletedCount: 2,
      agentIds: [agent.id, archivedAgent.id],
    });
  });

  it("reports subagents the daemon deletes with the agent", async () => {
    const child = {
      ...archivedAgent,
      labels: { "paseo.parent-agent-id": agent.id },
    };
    const grandchild = {
      ...archivedOutsideAgent,
      labels: { "paseo.parent-agent-id": child.id },
    };
    daemonAgents = [agent, child, grandchild];
    serverFeatures = { agentCascadeDelete: true };

    const result = await runDeleteCommand(agent.id, { daemonTarget }, {} as never);

    expect(deleteAgent).toHaveBeenCalledTimes(1);
    expect(deleteAgent).toHaveBeenCalledWith(agent.id);
    expect(result.data).toEqual({
      deletedCount: 3,
      agentIds: [agent.id, grandchild.id, child.id],
    });
  });

  it("sends one delete per tree with --all when the daemon cascades", async () => {
    const child = {
      ...archivedAgent,
      labels: { "paseo.parent-agent-id": agent.id },
    };
    daemonAgents = [child, agent, archivedOutsideAgent];
    serverFeatures = { agentCascadeDelete: true };

    const result = await runDeleteCommand(undefined, { daemonTarget, all: true }, {} as never);

    expect(deleteAgent).toHaveBeenCalledTimes(2);
    expect(deleteAgent).toHaveBeenCalledWith(agent.id);
    expect(deleteAgent).toHaveBeenCalledWith(archivedOutsideAgent.id);
    expect(result.data).toEqual({
      deletedCount: 3,
      agentIds: [agent.id, child.id, archivedOutsideAgent.id],
    });
  });
});
