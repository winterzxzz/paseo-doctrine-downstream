import type { Command } from "commander";
import { connectToDaemon } from "../../utils/client.js";
import { isSameOrDescendantPath } from "../../utils/paths.js";
import { getParentAgentIdFromLabels } from "@getpaseo/protocol/agent-labels";
import type { DaemonClient, FetchAgentHistoryEntry } from "@getpaseo/client/internal/daemon-client";

export function addDeleteOptions(cmd: Command): Command {
  return cmd
    .description(
      "Delete an agent and every subagent below it (interrupt if running, then hard-delete)",
    )
    .argument("[id]", "Agent ID (or prefix) - optional if --all or --cwd specified")
    .option("--all", "Delete all agents")
    .option("--cwd <path>", "Delete all agents in directory");
}
import type {
  CommandOptions,
  SingleResult,
  OutputSchema,
  CommandError,
} from "../../output/index.js";

export interface DeleteResult {
  deletedCount: number;
  agentIds: string[];
}

export const deleteSchema: OutputSchema<DeleteResult> = {
  idField: (item) => item.agentIds.join("\n"),
  columns: [{ header: "DELETED", field: "deletedCount" }],
};

export interface AgentDeleteOptions extends CommandOptions {
  all?: boolean;
  cwd?: string;
}

export type AgentDeleteResult = SingleResult<DeleteResult>;

// History includes archived agents and agents whose provider is unavailable.
async function fetchHistoryAgents(client: DaemonClient) {
  const agents: FetchAgentHistoryEntry["agent"][] = [];
  let cursor: string | undefined;
  do {
    const payload = await client.fetchAgentHistory({
      page: { limit: 200, ...(cursor ? { cursor } : {}) },
    });
    agents.push(...payload.entries.map((entry) => entry.agent));
    cursor = payload.pageInfo.nextCursor ?? undefined;
  } while (cursor);
  return agents;
}

type HistoryAgent = FetchAgentHistoryEntry["agent"];

export interface CascadeDeletePlan {
  /** Targets to send a delete for: those with no ancestor also being deleted. */
  roots: HistoryAgent[];
  /** Ids the daemon deletes with each root, deepest first. */
  descendantIdsByRootId: Map<string, string[]>;
}

/**
 * The daemon deletes an agent's whole subagent tree. Sending a delete for an agent whose
 * ancestor is also targeted would race that cascade, so only the topmost targets are sent.
 */
export function planCascadeDelete(
  targets: readonly HistoryAgent[],
  allAgents: readonly HistoryAgent[],
): CascadeDeletePlan {
  const parentById = new Map<string, string | null>();
  const childrenByParent = new Map<string, string[]>();
  for (const agent of allAgents) {
    const parentId = getParentAgentIdFromLabels(agent.labels);
    parentById.set(agent.id, parentId);
    if (parentId) {
      childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), agent.id]);
    }
  }
  const targetIds = new Set(targets.map((agent) => agent.id));
  const hasTargetedAncestor = (agentId: string): boolean => {
    const seen = new Set<string>([agentId]);
    let parentId = parentById.get(agentId) ?? null;
    while (parentId && !seen.has(parentId)) {
      if (targetIds.has(parentId)) return true;
      seen.add(parentId);
      parentId = parentById.get(parentId) ?? null;
    }
    return false;
  };
  const roots = targets.filter((agent) => !hasTargetedAncestor(agent.id));
  const descendantIdsByRootId = new Map<string, string[]>();
  for (const root of roots) {
    const descendants: string[] = [];
    const seen = new Set<string>([root.id]);
    const queue = [...(childrenByParent.get(root.id) ?? [])];
    while (queue.length > 0) {
      const id = queue.shift() as string;
      if (seen.has(id)) continue;
      seen.add(id);
      descendants.push(id);
      queue.push(...(childrenByParent.get(id) ?? []));
    }
    descendantIdsByRootId.set(root.id, descendants.toReversed());
  }
  return { roots, descendantIdsByRootId };
}

export async function runDeleteCommand(
  id: string | undefined,
  options: AgentDeleteOptions,
  _command: Command,
): Promise<AgentDeleteResult> {
  if (!id && !options.all && !options.cwd) {
    const error: CommandError = {
      code: "MISSING_ARGUMENT",
      message: "Agent ID required unless --all or --cwd is specified",
      details: "Usage: paseo agent delete <id> | --all | --cwd <path>",
    };
    throw error;
  }

  const client = await connectToDaemon({ target: options.daemonTarget });

  try {
    const deletedIds: string[] = [];
    let agents: FetchAgentHistoryEntry["agent"][];
    let history: HistoryAgent[] | null = null;

    if (options.all || options.cwd) {
      history = await fetchHistoryAgents(client);
      agents = history;
      if (!options.all) {
        agents = agents.filter((a) => isSameOrDescendantPath(options.cwd!, a.cwd));
      }
    } else {
      const fetchResult = await client.fetchAgent({ agentId: id! });
      if (!fetchResult) {
        const error: CommandError = {
          code: "AGENT_NOT_FOUND",
          message: `No agent found matching: ${id}`,
          details: "Use `paseo ls` to list available agents",
        };
        throw error;
      }
      agents = [fetchResult.agent];
    }

    // COMPAT(agentCascadeDelete): added in v0.11.2-paseo.85, remove gate after 2027-04-17.
    const cascades = client.getLastServerInfoMessage()?.features?.agentCascadeDelete === true;
    let descendantIdsByRootId = new Map<string, string[]>();
    if (cascades) {
      const plan = planCascadeDelete(agents, history ?? (await fetchHistoryAgents(client)));
      agents = plan.roots;
      descendantIdsByRootId = plan.descendantIdsByRootId;
    }

    const deleteResults = await Promise.all(
      agents.map(async (agent) => {
        try {
          if (agent.status === "running") {
            await client.cancelAgent(agent.id).catch(() => {});
          }
          await client.deleteAgent(agent.id);
          return { ok: true as const, id: agent.id };
        } catch (err) {
          if (err && typeof err === "object" && "code" in err) throw err;
          const message = err instanceof Error ? err.message : String(err);
          return { ok: false as const, id: agent.id, message };
        }
      }),
    );
    for (const result of deleteResults) {
      if (result.ok) {
        deletedIds.push(result.id, ...(descendantIdsByRootId.get(result.id) ?? []));
      } else {
        console.error(
          `Warning: Failed to delete agent ${result.id.slice(0, 7)}: ${result.message}`,
        );
      }
    }

    await client.close();

    return {
      type: "single",
      data: {
        deletedCount: deletedIds.length,
        agentIds: deletedIds,
      },
      schema: deleteSchema,
    };
  } catch (err) {
    await client.close().catch(() => {});
    if (err && typeof err === "object" && "code" in err) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    const error: CommandError = {
      code: "DELETE_AGENT_FAILED",
      message: `Failed to delete agent(s): ${message}`,
    };
    throw error;
  }
}
