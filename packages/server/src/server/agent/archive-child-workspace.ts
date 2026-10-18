import type { Logger } from "pino";
import { getParentAgentIdFromLabels } from "@getpaseo/protocol/agent-labels";

import type { StoredAgentRecord } from "./agent-storage.js";
import type { PersistedWorkspaceRecord } from "../workspace-registry.js";

export interface ArchiveChildWorkspaceDependencies {
  agentStorage: {
    get(agentId: string): Promise<StoredAgentRecord | null>;
    listByWorkspace(workspaceId: string): Promise<StoredAgentRecord[]>;
  };
  workspaceRegistry: { get(workspaceId: string): Promise<PersistedWorkspaceRecord | null> };
  archiveWorkspaceRecord: (workspaceId: string) => Promise<void>;
  emitWorkspaceUpdatesForWorkspaceIds: (workspaceIds: Iterable<string>) => Promise<void>;
  logger: Logger;
}

/**
 * A Lead archives the Peers it spawned, but each Peer can own a workspace of its own. Once the
 * last agent in such a workspace is archived and every agent in it was spawned by another agent,
 * the workspace has nothing left for the Human, so it is archived too. A workspace that holds a
 * Human-created agent, a live agent, or a worktree keeps its normal archive rules.
 */
export async function archiveWorkspaceLeftByArchivedChild(
  dependencies: ArchiveChildWorkspaceDependencies,
  agentId: string,
): Promise<string | null> {
  const record = await dependencies.agentStorage.get(agentId);
  const workspaceId = record?.workspaceId;
  if (!record?.archivedAt || !workspaceId || !getParentAgentIdFromLabels(record.labels)) {
    return null;
  }

  const workspace = await dependencies.workspaceRegistry.get(workspaceId);
  if (!workspace || workspace.archivedAt || workspace.kind === "worktree") {
    return null;
  }

  const workspaceAgents = await dependencies.agentStorage.listByWorkspace(workspaceId);
  const keepsWorkspace = workspaceAgents.some(
    (agent) => !agent.archivedAt || !getParentAgentIdFromLabels(agent.labels),
  );
  if (keepsWorkspace) {
    return null;
  }

  await dependencies.archiveWorkspaceRecord(workspaceId);
  await dependencies.emitWorkspaceUpdatesForWorkspaceIds([workspaceId]);
  dependencies.logger.info(
    { agentId, workspaceId },
    "Archived workspace left with only archived child agents",
  );
  return workspaceId;
}
