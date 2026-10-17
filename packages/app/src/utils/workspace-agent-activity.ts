import type { PaseoRoleId } from "@getpaseo/protocol/role-binding";
import type { Agent, WorkspaceDescriptor } from "@/stores/session-store";
import { isWorkspaceRootAgent } from "@/subagents/policies";
import { deriveSidebarStateBucket } from "./sidebar-agent-state";

export interface WorkspaceAgentActivity {
  agentId: string;
  status: WorkspaceDescriptor["status"];
  enteredAt: Date | null;
  // Role of the root agent, when it is role-bound.
  roleId?: PaseoRoleId;
  // Only roots get a sidebar row: a Supervisor, or an agent the Human created. Anything an
  // agent spawned (a Lead under a Supervisor, an Engineer or Peer under a Lead, a reviewer)
  // is reached from its parent's subagents track, so a workspace that holds only such
  // children stays out of the sidebar.
  hiddenFromSidebar?: true;
}

function workspaceAgentStatus(agent: Agent): Agent["status"] {
  if (agent.turn.phase === "open") return "running";
  return agent.status === "running" ? "idle" : agent.status;
}

export function buildWorkspaceAgentActivityIndex(
  agents: ReadonlyMap<string, Agent>,
  previous?: ReadonlyMap<string, WorkspaceAgentActivity>,
): Map<string, WorkspaceAgentActivity> {
  const activityByWorkspaceId = new Map<string, WorkspaceAgentActivity>();
  const latestActivityAtByWorkspaceId = new Map<string, Date>();
  const workspacesWithHumanRoot = new Set<string>();

  for (const agent of agents.values()) {
    const parentAgent = agent.parentAgentId ? agents.get(agent.parentAgentId) : undefined;
    if (agent.archivedAt || !agent.workspaceId || !isWorkspaceRootAgent(agent, parentAgent)) {
      continue;
    }
    if (!parentAgent) {
      workspacesWithHumanRoot.add(agent.workspaceId);
    }

    const enteredAt = agent.attentionTimestamp ?? agent.updatedAt;
    const latestActivityAt = latestActivityAtByWorkspaceId.get(agent.workspaceId);
    if (latestActivityAt && enteredAt <= latestActivityAt) {
      continue;
    }
    latestActivityAtByWorkspaceId.set(agent.workspaceId, enteredAt);

    activityByWorkspaceId.set(agent.workspaceId, rootAgentActivity(agent, parentAgent, enteredAt));
  }

  for (const [workspaceId, activity] of activityByWorkspaceId) {
    if (workspacesWithHumanRoot.has(workspaceId) && activity.hiddenFromSidebar) {
      const { hiddenFromSidebar: _hidden, ...visible } = activity;
      activityByWorkspaceId.set(workspaceId, visible);
    }
  }

  for (const [workspaceId, activity] of activityByWorkspaceId) {
    const previousActivity = previous?.get(workspaceId);
    if (previousActivity && isSameActivity(previousActivity, activity)) {
      activityByWorkspaceId.set(workspaceId, previousActivity);
    }
  }

  if (previous && areWorkspaceAgentActivityIndexesIdentical(previous, activityByWorkspaceId)) {
    return previous instanceof Map ? previous : new Map(previous);
  }
  return activityByWorkspaceId;
}

function rootAgentActivity(
  agent: Agent,
  parentAgent: Agent | undefined,
  enteredAt: Date,
): WorkspaceAgentActivity {
  const status = deriveSidebarStateBucket({
    status: workspaceAgentStatus(agent),
    pendingPermissionCount: agent.pendingPermissions.length,
    requiresAttention: agent.requiresAttention,
    attentionReason: agent.attentionReason,
  });
  const roleId = agent.roleBinding?.roleId;
  const hiddenFromSidebar = parentAgent !== undefined;
  return {
    agentId: agent.id,
    status,
    enteredAt,
    ...(roleId ? { roleId } : {}),
    ...(hiddenFromSidebar ? { hiddenFromSidebar: true } : {}),
  };
}

// enteredAt is deliberately ignored: an unchanged status keeps its original entry time.
function isSameActivity(previous: WorkspaceAgentActivity, next: WorkspaceAgentActivity): boolean {
  return (
    previous.agentId === next.agentId &&
    previous.status === next.status &&
    previous.roleId === next.roleId &&
    previous.hiddenFromSidebar === next.hiddenFromSidebar
  );
}

function areWorkspaceAgentActivityIndexesIdentical(
  previous: ReadonlyMap<string, WorkspaceAgentActivity>,
  next: ReadonlyMap<string, WorkspaceAgentActivity>,
): boolean {
  if (previous.size !== next.size) {
    return false;
  }
  for (const [workspaceId, activity] of next) {
    if (previous.get(workspaceId) !== activity) {
      return false;
    }
  }
  return true;
}
