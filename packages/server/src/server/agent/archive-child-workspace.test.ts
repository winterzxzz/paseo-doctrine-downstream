import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import pino from "pino";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PARENT_AGENT_ID_LABEL } from "@getpaseo/protocol/agent-labels";

import { archiveWorkspaceLeftByArchivedChild } from "./archive-child-workspace.js";
import { AgentStorage, type StoredAgentRecord } from "./agent-storage.js";
import {
  createPersistedWorkspaceRecord,
  type PersistedWorkspaceRecord,
} from "../workspace-registry.js";

const logger = pino({ level: "silent" });
const now = "2026-10-18T00:00:00.000Z";

function storedAgent(input: {
  id: string;
  workspaceId: string;
  parentAgentId?: string;
  archived?: boolean;
}): StoredAgentRecord {
  return {
    id: input.id,
    provider: "claude",
    cwd: "/repo",
    workspaceId: input.workspaceId,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
    lastUserMessageAt: null,
    title: input.id,
    labels: input.parentAgentId ? { [PARENT_AGENT_ID_LABEL]: input.parentAgentId } : {},
    lastStatus: "closed",
    lastModeId: "default",
    config: { modeId: "default", model: "claude-opus-5-5" },
    runtimeInfo: { provider: "claude", sessionId: `session-${input.id}`, model: "claude-opus-5-5" },
    features: [],
    persistence: { provider: "claude", sessionId: `session-${input.id}` },
    requiresAttention: false,
    attentionReason: null,
    attentionTimestamp: null,
    internal: false,
    archivedAt: input.archived ? now : null,
  };
}

function workspace(
  workspaceId: string,
  kind: PersistedWorkspaceRecord["kind"] = "local_checkout",
): PersistedWorkspaceRecord {
  return createPersistedWorkspaceRecord({
    workspaceId,
    projectId: "project-1",
    cwd: "/repo",
    kind,
    displayName: workspaceId,
    createdAt: now,
    updatedAt: now,
  });
}

describe("archiveWorkspaceLeftByArchivedChild", () => {
  let baseDir: string;
  let agentStorage: AgentStorage;
  let workspaces: Map<string, PersistedWorkspaceRecord>;
  let archivedWorkspaceIds: string[];
  let emittedWorkspaceIds: string[];

  beforeEach(async () => {
    baseDir = await mkdtemp(path.join(tmpdir(), "archive-child-workspace-"));
    agentStorage = new AgentStorage(baseDir, logger);
    workspaces = new Map();
    archivedWorkspaceIds = [];
    emittedWorkspaceIds = [];
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  async function seed(records: StoredAgentRecord[], workspaceRecords: PersistedWorkspaceRecord[]) {
    for (const record of records) await agentStorage.upsert(record);
    for (const record of workspaceRecords) workspaces.set(record.workspaceId, record);
  }

  function run(agentId: string) {
    return archiveWorkspaceLeftByArchivedChild(
      {
        agentStorage,
        workspaceRegistry: { get: async (id) => workspaces.get(id) ?? null },
        archiveWorkspaceRecord: async (id) => {
          archivedWorkspaceIds.push(id);
        },
        emitWorkspaceUpdatesForWorkspaceIds: async (ids) => {
          emittedWorkspaceIds.push(...ids);
        },
        logger,
      },
      agentId,
    );
  }

  it("archives a Peer's own workspace once the Lead archives that Peer", async () => {
    await seed(
      [
        storedAgent({ id: "lead", workspaceId: "wks-lead" }),
        storedAgent({ id: "peer", workspaceId: "wks-peer", parentAgentId: "lead", archived: true }),
      ],
      [workspace("wks-lead"), workspace("wks-peer")],
    );

    await expect(run("peer")).resolves.toBe("wks-peer");
    expect(archivedWorkspaceIds).toEqual(["wks-peer"]);
    expect(emittedWorkspaceIds).toEqual(["wks-peer"]);
  });

  it("keeps a workspace that still holds an unarchived agent", async () => {
    await seed(
      [
        storedAgent({ id: "a", workspaceId: "wks", parentAgentId: "lead", archived: true }),
        storedAgent({ id: "b", workspaceId: "wks", parentAgentId: "lead" }),
      ],
      [workspace("wks")],
    );

    await expect(run("a")).resolves.toBeNull();
    expect(archivedWorkspaceIds).toEqual([]);
  });

  it("keeps a workspace that holds a Human-created agent, even an archived one", async () => {
    await seed(
      [
        storedAgent({ id: "human", workspaceId: "wks", archived: true }),
        storedAgent({ id: "child", workspaceId: "wks", parentAgentId: "human", archived: true }),
      ],
      [workspace("wks")],
    );

    await expect(run("child")).resolves.toBeNull();
    expect(archivedWorkspaceIds).toEqual([]);
  });

  it("leaves worktree workspaces and Human-created agents to the normal archive rules", async () => {
    await seed(
      [
        storedAgent({ id: "peer", workspaceId: "wks-tree", parentAgentId: "lead", archived: true }),
        storedAgent({ id: "human", workspaceId: "wks-human", archived: true }),
      ],
      [workspace("wks-tree", "worktree"), workspace("wks-human")],
    );

    await expect(run("peer")).resolves.toBeNull();
    await expect(run("human")).resolves.toBeNull();
    expect(archivedWorkspaceIds).toEqual([]);
  });
});
