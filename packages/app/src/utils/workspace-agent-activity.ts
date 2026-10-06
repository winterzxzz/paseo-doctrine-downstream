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
  // A Lead created by a Supervisor is reached from the Supervisor's subagents track, the
  // same way a Peer is reached from its Lead, so its workspace stays out of the sidebar.
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

  for (const agent of agents.values()) {
    const parentAgent = agent.parentAgentId ? agents.get(agent.parentAgentId) : undefined;
    if (agent.archivedAt || !agent.workspaceId || !isWorkspaceRootAgent(agent, parentAgent)) {
      continue;
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
  const hiddenFromSidebar = roleId === "lead" && parentAgent?.roleBinding?.roleId === "supervisor";
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
