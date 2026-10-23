import type { PaseoRoleId } from "@getpaseo/protocol/role-binding";
import type { Agent } from "@/stores/session-store";
import { normalizeWorkspaceOpaqueId } from "@/utils/workspace-identity";

export type TopologyRole = PaseoRoleId | "unbound";
export type TopologyEdgeKind = "delegation" | "supervision";

export interface TopologyNode {
  id: string;
  title: string;
  shortId: string;
  role: TopologyRole;
  status: Agent["status"];
  provider: string;
  model: string | null;
  modeId: string | null;
  assignmentDisposition: string | null;
  launchProfile: Agent["launchProfile"] | null;
  workspaceId: string | null;
  requiresAttention: boolean;
  attentionReason: Agent["attentionReason"] | null;
  lastActivityAt: Date | null;
  /** When the current turn opened; null while no turn is open. */
  turnStartedAt: Date | null;
  /** When the agent began waiting on the Human (permission, error, or finished). */
  attentionAt: Date | null;
  /** What the oldest pending permission asks for, in one line. */
  pendingPermission: string | null;
  lastError: string | null;
  issueIds: string[];
  /** Tokens in the agent's context window after its latest turn; null when the provider did not report it. */
  contextTokens: number | null;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  kind: TopologyEdgeKind;
  provenance: "exact" | "inferred";
}

export type TopologyWarningCode =
  | "ambiguous_lead"
  | "ambiguous_supervisor"
  | "missing_parent"
  | "role_mismatch";

export interface TopologyWarning {
  code: TopologyWarningCode;
  agentId?: string;
}

export interface WorkspaceTopology {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  warnings: TopologyWarning[];
  counts: Record<TopologyRole, number>;
}

export function formatTopologyAssignment(
  node: Pick<TopologyNode, "role" | "assignmentDisposition" | "launchProfile">,
): string | null {
  if (!node.launchProfile?.peerSubrole && !node.assignmentDisposition) return null;

  let roleLabel: string;
  if (node.launchProfile?.peerSubrole) {
    roleLabel = `Peer ${node.launchProfile.peerSubrole}`;
  } else if (node.role === "unbound") {
    roleLabel = "Unbound";
  } else {
    roleLabel = `${node.role[0].toUpperCase()}${node.role.slice(1)}`;
  }
  return node.assignmentDisposition
    ? `${roleLabel} · ${node.assignmentDisposition.replaceAll("_", " ")}`
    : roleLabel;
}

const MODEL_WORDS: Record<string, string> = {
  gpt: "GPT",
  glm: "GLM",
  oss: "OSS",
  xai: "xAI",
  mini: "mini",
  nano: "nano",
};

/**
 * A short, readable model name for compact surfaces: "claude-opus-5-5" →
 * "Opus 5.5", "factory-droid/gpt-6-astra" → "GPT-6 Astra". The exact route
 * stays available to callers for tooltips; this is display text only.
 */
export function formatTopologyModelName(model: string | null): string | null {
  let id = model?.trim() ?? "";
  if (!id) return null;
  id = id.replace(/\[[^\]]*\]$/, "");
  id = id.split("/").pop() ?? id;
  id = id
    .replace(/[-_@]\d{8}$/, "")
    .replace(/[-_]latest$/i, "")
    .replace(/^claude[-_]/i, "");
  const merged: string[] = [];
  for (const token of id.split(/[-_\s]+/).filter(Boolean)) {
    const previous = merged.at(-1);
    if (previous && /^\d+(\.\d+)*$/.test(previous) && /^\d{1,2}$/.test(token)) {
      merged[merged.length - 1] = `${previous}.${token}`;
    } else {
      merged.push(token);
    }
  }
  if (merged.length === 0) return model?.trim() ?? null;
  const words = merged.map((token) => {
    const known = MODEL_WORDS[token.toLowerCase()];
    if (known) return known;
    if (/^\d/.test(token) || /^o\d/.test(token)) return token;
    return `${token.charAt(0).toUpperCase()}${token.slice(1)}`;
  });
  if (/^\d/.test(words[0]) && /^claude/i.test(model ?? "")) words.unshift("Claude");
  const parts: string[] = [];
  for (const word of words) {
    const previous = parts.at(-1);
    if (previous === "GPT" && /^\d/.test(word)) parts[parts.length - 1] = `GPT-${word}`;
    else parts.push(word);
  }
  return parts.join(" ");
}

/** "factory-droid" → "Factory Droid". */
export function formatTopologyProviderName(provider: string): string {
  return provider
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

/** Drops trailing parentheticals: "Peer Image (GPT-6 Astra)" → "Peer Image". */
export function shortTopologyProfileName(name: string): string {
  const short = name.replace(/(\s*\([^()]*\))+\s*$/, "").trim();
  return short || name.trim();
}

const ELEVATED_MODE_IDS = new Set([
  "bypassPermissions",
  "full-access",
  "danger-full-access",
  "auto-high",
  "yolo",
  "unattended",
]);

/** Whether the agent runs in a mode that skips per-action approval. */
export function isElevatedTopologyMode(modeId: string | null): boolean {
  return modeId !== null && ELEVATED_MODE_IDS.has(modeId);
}

function roleOf(agent: Agent): TopologyRole {
  return agent.roleBinding?.roleId ?? agent.launchContract?.roleId ?? "unbound";
}

function titleOf(agent: Agent): string {
  const title = agent.title?.trim();
  return (
    title || `${roleOf(agent) === "unbound" ? "Agent" : roleOf(agent)} ${agent.id.slice(0, 8)}`
  );
}

function pendingPermissionOf(agent: Agent): string | null {
  const request = agent.pendingPermissions?.[0];
  if (!request) return null;
  return request.title?.trim() || request.description?.trim() || request.name;
}

function issueIdsOf(agent: Agent): string[] {
  const issueIds = agent.roleBinding?.assignment?.resourceGrants?.beadsIssueIds;
  return [...new Set(issueIds ?? [])].sort();
}

function assignmentParentAgentIdOf(agent: Agent): string | null {
  const roleBindingAssigner = agent.roleBinding?.assignment?.assigner;
  return roleBindingAssigner?.kind === "agent" ? roleBindingAssigner.agentId : null;
}

function parentAgentIdOf(agent: Agent): string | null {
  return agent.parentAgentId ?? assignmentParentAgentIdOf(agent);
}

function selectTopologyAgentIds(
  visibleAgents: readonly Agent[],
  seedAgentIds: readonly string[],
  includeDescendants = true,
): Set<string> {
  const visibleById = new Map(visibleAgents.map((agent) => [agent.id, agent]));
  const selectedIds = new Set(seedAgentIds);

  for (const seedId of seedAgentIds) {
    let current = visibleById.get(seedId);
    const visited = new Set<string>();
    let parentAgentId = current ? parentAgentIdOf(current) : null;
    while (parentAgentId && !visited.has(parentAgentId)) {
      visited.add(parentAgentId);
      const parent = visibleById.get(parentAgentId);
      if (!parent) break;
      selectedIds.add(parent.id);
      current = parent;
      parentAgentId = parentAgentIdOf(current);
    }
  }

  if (!includeDescendants) return selectedIds;

  const descendantQueue = [...seedAgentIds];
  for (let index = 0; index < descendantQueue.length; index += 1) {
    const parentId = descendantQueue[index];
    for (const candidate of visibleAgents) {
      if (parentAgentIdOf(candidate) !== parentId || selectedIds.has(candidate.id)) continue;
      selectedIds.add(candidate.id);
      descendantQueue.push(candidate.id);
    }
  }
  return selectedIds;
}

export function buildWorkspaceTopology(
  agents: ReadonlyMap<string, Agent> | undefined,
  workspaceId: string,
): WorkspaceTopology {
  const normalizedWorkspaceId = normalizeWorkspaceOpaqueId(workspaceId);
  const visibleAgents = [...(agents?.values() ?? [])].filter((agent) => !agent.archivedAt);
  const workspaceSeedIds = visibleAgents
    .filter((agent) => normalizeWorkspaceOpaqueId(agent.workspaceId) === normalizedWorkspaceId)
    .map((agent) => agent.id);
  const selectedIds = selectTopologyAgentIds(visibleAgents, workspaceSeedIds);

  const workspaceAgents = visibleAgents
    .filter((agent) => selectedIds.has(agent.id))
    .sort(
      (left, right) =>
        left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id),
    );

  return buildTopology(workspaceAgents);
}

export function buildProjectTopology(
  agents: ReadonlyMap<string, Agent> | undefined,
  workspaceIds: readonly string[],
): WorkspaceTopology {
  const normalizedWorkspaceIds = new Set(
    workspaceIds.map(normalizeWorkspaceOpaqueId).filter((id): id is string => id !== null),
  );
  const visibleAgents = [...(agents?.values() ?? [])].filter((agent) => !agent.archivedAt);
  const projectSeedIds = visibleAgents
    .filter((agent) =>
      normalizedWorkspaceIds.has(normalizeWorkspaceOpaqueId(agent.workspaceId) ?? ""),
    )
    .map((agent) => agent.id);
  const selectedIds = selectTopologyAgentIds(visibleAgents, projectSeedIds, false);
  const projectAgents = visibleAgents
    .filter((agent) => selectedIds.has(agent.id))
    .sort(
      (left, right) =>
        left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id),
    );
  return buildTopology(projectAgents);
}

export function buildHostTopology(
  agents: ReadonlyMap<string, Agent> | undefined,
): WorkspaceTopology {
  const visibleAgents = [...(agents?.values() ?? [])]
    .filter((agent) => !agent.archivedAt)
    .sort(
      (left, right) =>
        left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id),
    );
  return buildTopology(visibleAgents);
}

function buildTopology(topologyAgents: readonly Agent[]): WorkspaceTopology {
  const nodes = topologyAgents.map<TopologyNode>((agent) => ({
    id: agent.id,
    title: titleOf(agent),
    shortId: agent.id.slice(0, 8),
    role: roleOf(agent),
    status: agent.status,
    provider: agent.provider,
    model: agent.model,
    modeId: agent.currentModeId,
    assignmentDisposition: agent.roleBinding?.assignment?.disposition ?? null,
    launchProfile: agent.launchProfile ?? null,
    workspaceId: agent.workspaceId ?? null,
    requiresAttention: agent.requiresAttention ?? false,
    attentionReason: agent.attentionReason ?? null,
    lastActivityAt: agent.lastActivityAt ?? null,
    turnStartedAt: agent.turn?.phase === "open" ? agent.turn.startedAt : null,
    attentionAt: agent.attentionTimestamp ?? null,
    pendingPermission: pendingPermissionOf(agent),
    lastError: agent.lastError?.trim() || null,
    issueIds: issueIdsOf(agent),
    contextTokens: agent.lastUsage?.contextWindowUsedTokens ?? null,
  }));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const sourceById = new Map(topologyAgents.map((agent) => [agent.id, agent]));
  const edges: TopologyEdge[] = [];
  const warnings: TopologyWarning[] = [];

  for (const agent of topologyAgents) {
    const parentAgentId = parentAgentIdOf(agent);
    if (!parentAgentId) continue;
    const parent = sourceById.get(parentAgentId);
    if (!parent || !nodeById.has(parent.id)) {
      warnings.push({ code: "missing_parent", agentId: agent.id });
      continue;
    }
    const isSupervision = roleOf(parent) === "supervisor" && roleOf(agent) === "lead";
    const isDelegation = roleOf(parent) === "lead" && roleOf(agent) === "peer";
    const kind: TopologyEdgeKind = isSupervision ? "supervision" : "delegation";
    edges.push({
      id: `${kind}:${parent.id}:${agent.id}`,
      source: parent.id,
      target: agent.id,
      kind,
      provenance: "exact",
    });
    if (!isSupervision && !isDelegation) {
      warnings.push({ code: "role_mismatch", agentId: agent.id });
    }
  }

  const counts: Record<TopologyRole, number> = {
    lead: 0,
    peer: 0,
    supervisor: 0,
    unbound: 0,
  };
  for (const node of nodes) counts[node.role] += 1;
  return { nodes, edges, warnings, counts };
}
