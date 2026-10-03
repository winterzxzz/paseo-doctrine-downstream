import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DaemonConnectionError } from "@getpaseo/client/internal/daemon-client";
import {
  buildCliAssignment,
  requireAssignmentFramingSupport,
  resolveExistingRunWorkspace,
  validateAssignmentFramingOptions,
  resolveRunCallerAgentId,
  runRunCommand,
  type AgentRunOptions,
} from "./run";

const daemonTarget = { kind: "endpoint" as const, host: "example.test:12345" };

// Answers fetchAgent the way a daemon does: an unknown id is an error.
function daemonWithAgents(...agentIds: string[]) {
  return {
    async fetchAgent({ agentId }: { agentId: string }) {
      if (!agentIds.includes(agentId)) {
        throw new Error(`Agent not found: ${agentId}`);
      }
      return { agent: { id: agentId } };
    },
  };
}

describe("managed agent caller context", () => {
  it("uses a trimmed PASEO_AGENT_ID when the target daemon runs that agent", async () => {
    await expect(
      resolveRunCallerAgentId(daemonWithAgents("parent-agent"), {
        PASEO_AGENT_ID: "  parent-agent  ",
      }),
    ).resolves.toBe("parent-agent");
  });

  it("runs without a caller when PASEO_AGENT_ID belongs to another daemon", async () => {
    await expect(
      resolveRunCallerAgentId(daemonWithAgents("other-agent"), {
        PASEO_AGENT_ID: "parent-agent",
      }),
    ).resolves.toBeUndefined();
  });

  it("fails instead of dropping the caller when the lookup loses its connection", async () => {
    const disconnectedDaemon = {
      async fetchAgent(): Promise<never> {
        throw new DaemonConnectionError("Connection lost before message could be sent");
      },
    };

    await expect(
      resolveRunCallerAgentId(disconnectedDaemon, { PASEO_AGENT_ID: "parent-agent" }),
    ).rejects.toBeInstanceOf(DaemonConnectionError);
  });

  it("omits blank caller ids", async () => {
    await expect(
      resolveRunCallerAgentId(daemonWithAgents(), { PASEO_AGENT_ID: "   " }),
    ).resolves.toBeUndefined();
  });
});

describe("CLI assignment issue grants", () => {
  it("normalizes exact Peer issue grants into the immutable envelope", () => {
    expect(
      buildCliAssignment({
        roleId: "peer",
        effectClass: "mutating",
        objective: "Implement the granted issue",
        cwd: "/repo",
        beadsIssueIds: [" ps123-abc ", "ps123-abc"],
      }),
    ).toMatchObject({
      resourceGrants: { beadsIssueIds: ["ps123-abc"] },
      externalEffectBoundary: {
        mode: "bounded",
        scope: "Beads Central issue/work graph for this assignment only; no other external effects",
      },
    });
  });
});

describe("CLI assignment framing", () => {
  it("rejects framing flags without an assignment and rejects blank values", () => {
    expect(() =>
      validateAssignmentFramingOptions({ rationale: "why" } as AgentRunOptions, undefined),
    ).toThrow(
      expect.objectContaining({
        code: "INVALID_OPTIONS",
        message: "--rationale and --open-assumptions require --role and --assignment-effect",
      }),
    );
    expect(() =>
      validateAssignmentFramingOptions({ openAssumptions: "   " } as AgentRunOptions, "read-only"),
    ).toThrow(expect.objectContaining({ message: "--open-assumptions cannot be blank" }));
    expect(() =>
      validateAssignmentFramingOptions({ rationale: "why" } as AgentRunOptions, "read-only"),
    ).not.toThrow();
  });

  it("requires a host that advertises assignmentFraming only when framing flags are used", () => {
    const oldHost = { getLastServerInfoMessage: () => ({ features: {} }) };
    const newHost = { getLastServerInfoMessage: () => ({ features: { assignmentFraming: true } }) };
    expect(() =>
      requireAssignmentFramingSupport(oldHost, { rationale: "why" } as AgentRunOptions),
    ).toThrow(expect.objectContaining({ code: "DAEMON_UPDATE_REQUIRED" }));
    expect(() =>
      requireAssignmentFramingSupport(newHost, { rationale: "why" } as AgentRunOptions),
    ).not.toThrow();
    expect(() => requireAssignmentFramingSupport(oldHost, {} as AgentRunOptions)).not.toThrow();
  });

  it("builds the envelope with trimmed rationale and open assumptions", () => {
    expect(
      buildCliAssignment({
        roleId: "lead",
        effectClass: "read-only",
        objective: "Assess the realtime layer",
        cwd: "/repo",
        rationale: "  Browser must see call state before ringing  ",
        openAssumptions: "WebSocket is only the candidate transport",
      }),
    ).toMatchObject({
      rationale: "Browser must see call state before ringing",
      openAssumptions: "WebSocket is only the candidate transport",
    });
    const bare = buildCliAssignment({
      roleId: "lead",
      effectClass: "read-only",
      objective: "Assess the realtime layer",
      cwd: "/repo",
      rationale: "   ",
    });
    expect(bare).not.toHaveProperty("rationale");
    expect(bare).not.toHaveProperty("openAssumptions");
  });
});

describe("existing run workspace resolution", () => {
  it("queries the daemon for an exact workspace id and uses its directory", async () => {
    const fetchWorkspaces = vi.fn().mockResolvedValue({
      entries: [{ id: "workspace-2", workspaceDirectory: "/workspace/two" }],
      pageInfo: { nextCursor: null },
    });

    await expect(resolveExistingRunWorkspace({ fetchWorkspaces }, "workspace-2")).resolves.toEqual({
      id: "workspace-2",
      cwd: "/workspace/two",
    });
    expect(fetchWorkspaces).toHaveBeenCalledWith({
      filter: { query: "workspace-2" },
      page: { limit: 200 },
    });
  });

  it("rejects a workspace id absent from daemon state", async () => {
    const fetchWorkspaces = vi.fn().mockResolvedValue({
      entries: [],
      pageInfo: { nextCursor: null },
    });

    await expect(resolveExistingRunWorkspace({ fetchWorkspaces }, "missing")).rejects.toMatchObject(
      {
        code: "WORKSPACE_NOT_FOUND",
        message: "Workspace not found: missing",
      },
    );
  });
});

// validateRunOptions runs before the CLI ever connects to a daemon, so these
// invalid combinations reject without one running.
describe("runRunCommand option validation", () => {
  const originalWorkspaceId = process.env.PASEO_WORKSPACE_ID;

  beforeEach(() => {
    delete process.env.PASEO_WORKSPACE_ID;
  });

  afterEach(() => {
    if (originalWorkspaceId === undefined) {
      delete process.env.PASEO_WORKSPACE_ID;
    } else {
      process.env.PASEO_WORKSPACE_ID = originalWorkspaceId;
    }
  });

  async function expectInvalidOptions(
    options: Omit<AgentRunOptions, "daemonTarget">,
    messageMatch: RegExp,
  ) {
    await expect(
      runRunCommand("do something", { ...options, daemonTarget }, {} as never),
    ).rejects.toMatchObject({
      code: "INVALID_OPTIONS",
      message: expect.stringMatching(messageMatch),
    });
  }

  it("rejects --new-workspace combined with --workspace", async () => {
    await expectInvalidOptions(
      { newWorkspace: "worktree", workspace: "ws-1" },
      /--new-workspace and --workspace cannot be combined/,
    );
  });

  it("allows explicit worktree workspace creation through validation", async () => {
    // Explicit workspace creation with no --workspace
    // must clear validation. It still fails later (provider resolution), which
    // is enough to prove the new guard did not reject it.
    await expect(
      runRunCommand(
        "do something",
        { newWorkspace: "worktree", provider: undefined, daemonTarget },
        {} as never,
      ),
    ).rejects.not.toMatchObject({ code: "INVALID_OPTIONS" });
  });

  it("rejects unknown new workspace kinds", async () => {
    await expectInvalidOptions({ newWorkspace: "container" }, /Unsupported new workspace kind/);
  });

  it("rejects two workspace creation flags", async () => {
    await expectInvalidOptions(
      { newWorkspace: "local", worktree: "legacy-slug" },
      /--new-workspace and --worktree cannot be combined/,
    );
  });

  it("rejects an unknown worktree creation mode before connecting", async () => {
    await expectInvalidOptions(
      { newWorkspace: "worktree", worktreeMode: "container" },
      /Unsupported worktree mode/,
    );
  });

  it("rejects an unknown Paseo role before connecting", async () => {
    await expectInvalidOptions({ role: "architect" }, /Unsupported Paseo role/);
  });

  it("requires an explicit assignment effect for a role", async () => {
    await expectInvalidOptions({ role: "lead" }, /--assignment-effect is required with --role/);
  });

  it("rejects write scope for a no-write effect", async () => {
    await expectInvalidOptions(
      { role: "lead", assignmentEffect: "read-only", writeScope: "src/**" },
      /--write-scope is not allowed for read-only/,
    );
  });

  it("allows a read-only Peer without a grant and requires one for mutation", async () => {
    await expect(
      runRunCommand(
        "inspect current bytes",
        { role: "peer", assignmentEffect: "read-only", json: true },
        {} as never,
      ),
    ).rejects.not.toMatchObject({ code: "INVALID_OPTIONS" });
    await expectInvalidOptions(
      { role: "peer", assignmentEffect: "mutating" },
      /--beads-issue is required with --role peer --assignment-effect mutating/,
    );
  });

  it("rejects Peer issue grants on another role", async () => {
    await expectInvalidOptions(
      { role: "lead", assignmentEffect: "read-only", beadsIssue: ["ps123-abc"] },
      /--beads-issue is only valid with --role peer/,
    );
  });
});
