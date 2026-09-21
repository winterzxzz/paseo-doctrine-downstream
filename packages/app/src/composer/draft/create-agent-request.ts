import type { AgentSessionConfig } from "@getpaseo/protocol/agent-types";
import type { AgentSnapshotPayload, CreateAgentRequestMessage } from "@getpaseo/protocol/messages";
import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import { encodeImages } from "@/utils/encode-images";
import type { UserMessageImageAttachment } from "@/types/stream";
import type {
  AssignmentEffectClass,
  AssignmentEnvelope,
} from "@getpaseo/protocol/assignment-contract";
import { buildAssignmentEnvelope } from "@/workspace-protocol/assignment-envelope";
import type { PaseoRoleId } from "@getpaseo/protocol/role-binding";

export interface WorkspaceDraftAgentRoleFields {
  roleId?: PaseoRoleId;
  assignment?: AssignmentEnvelope;
}

export function buildRoleCreateFields(input: {
  roleId: PaseoRoleId | null | undefined;
  effectClass: AssignmentEffectClass;
  objective: string;
  cwd: string;
  beadsIssueIds: readonly string[];
}): WorkspaceDraftAgentRoleFields {
  if (!input.roleId) return {};
  return {
    roleId: input.roleId,
    assignment: buildAssignmentEnvelope({
      roleId: input.roleId,
      effectClass: input.effectClass,
      objective: input.objective,
      cwd: input.cwd,
      beadsIssueIds: input.beadsIssueIds,
    }),
  };
}

export interface WorkspaceDraftAgentRequest {
  workspaceId: string;
  config: AgentSessionConfig;
  text: string;
  clientMessageId: string;
  images?: UserMessageImageAttachment[];
  attachments?: CreateAgentRequestMessage["attachments"];
  roleFields?: WorkspaceDraftAgentRoleFields;
}

/**
 * Shared by the workspace draft tab and by the new-workspace screen when it finishes creation
 * after the user has already navigated away and no draft tab will ever mount.
 */
export async function requestWorkspaceDraftAgent(
  client: DaemonClient,
  request: WorkspaceDraftAgentRequest,
): Promise<AgentSnapshotPayload> {
  const images = await encodeImages(request.images);
  return await client.createAgent({
    config: request.config,
    workspaceId: request.workspaceId,
    ...request.roleFields,
    clientMessageId: request.clientMessageId,
    ...(request.text ? { initialPrompt: request.text } : {}),
    ...(images && images.length > 0 ? { images } : {}),
    ...(request.attachments && request.attachments.length > 0
      ? { attachments: request.attachments }
      : {}),
  });
}
