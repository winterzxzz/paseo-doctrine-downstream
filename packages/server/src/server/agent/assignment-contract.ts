import { createHash } from "node:crypto";
import {
  assignmentExternalEffectBoundaryFor,
  AssignmentContractReceiptSchema,
  AssignmentEnvelopeSchema,
  PASEO_ASSIGNMENT_CONTRACT_VERSION,
  type AssignmentAssignerReceipt,
  type AssignmentContractReceipt,
  type AssignmentEnvelope,
} from "@getpaseo/protocol/assignment-contract";
import type { PaseoRoleId } from "@getpaseo/protocol/role-binding";
import { z } from "zod";

export const ASSIGNMENT_CONTRACT_REQUIRED_ERROR = "assignment_contract_required";
export const ASSIGNMENT_CONTRACT_INVALID_ERROR = "assignment_contract_invalid";

export const PersistedAssignmentContractSchema = z.object({
  receipt: AssignmentContractReceiptSchema,
  envelope: AssignmentEnvelopeSchema,
});
export type PersistedAssignmentContract = z.infer<typeof PersistedAssignmentContractSchema>;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function requireFuture(iso: string | undefined, now: Date, field: string): void {
  if (iso !== undefined && Date.parse(iso) <= now.getTime()) {
    throw new Error(`${ASSIGNMENT_CONTRACT_INVALID_ERROR}: ${field} must be in the future`);
  }
}

function validateProtocolException(
  envelope: AssignmentEnvelope,
  assigner: AssignmentAssignerReceipt,
  cwd: string,
  now: Date,
): void {
  const exception = envelope.protocolException;
  if (!exception) return;
  if (assigner.kind !== "human-session") {
    throw new Error(
      `${ASSIGNMENT_CONTRACT_INVALID_ERROR}: protocol exception requires Human session issuer`,
    );
  }
  if (exception.scope !== cwd) {
    throw new Error(
      `${ASSIGNMENT_CONTRACT_INVALID_ERROR}: protocol exception scope must equal assignment cwd`,
    );
  }
  requireFuture(exception.expiresAt, now, "protocolException.expiresAt");
}

function canonicalAssignmentBytes(input: {
  roleId: PaseoRoleId;
  assigner: AssignmentAssignerReceipt;
  workspaceId: string;
  cwd: string;
  envelope: AssignmentEnvelope;
  createdAt: string;
}): string {
  return JSON.stringify({
    version: PASEO_ASSIGNMENT_CONTRACT_VERSION,
    roleId: input.roleId,
    assigner: input.assigner,
    workspaceId: input.workspaceId,
    cwd: input.cwd,
    envelope: input.envelope,
    createdAt: input.createdAt,
  });
}

/**
 * Agent-authored envelopes routinely send `externalEffectBoundary: denied` because the
 * model reads "external effects" as network access, not Beads. App and CLI launches
 * fill in the role default; agent-to-agent `create_agent` does the same here so a
 * mutating Lead or Peer always receives its narrow Beads Central lease. A caller that
 * already passed a bounded lease keeps its own scope.
 */
export function withRoleDefaultExternalEffectLease<T extends AssignmentEnvelope | undefined>(
  roleId: PaseoRoleId | undefined,
  envelope: T,
): T {
  if (!roleId || !envelope || envelope.externalEffectBoundary.mode !== "denied") return envelope;
  const roleDefault = assignmentExternalEffectBoundaryFor(roleId, envelope.effectClass);
  if (roleDefault.mode === "denied") return envelope;
  return { ...envelope, externalEffectBoundary: roleDefault };
}

export function materializeAssignmentContract(input: {
  roleId: PaseoRoleId;
  assigner: AssignmentAssignerReceipt;
  workspaceId: string;
  cwd: string;
  envelope: AssignmentEnvelope | undefined;
  createdAt?: Date;
}): PersistedAssignmentContract {
  const now = input.createdAt ?? new Date();
  const envelope = preflightAssignmentEnvelope({
    roleId: input.roleId,
    envelope: input.envelope,
    createdAt: now,
  });
  validateProtocolException(envelope, input.assigner, input.cwd, now);

  const createdAt = now.toISOString();
  const receipt: AssignmentContractReceipt = {
    version: PASEO_ASSIGNMENT_CONTRACT_VERSION,
    assignmentDigest: sha256(
      canonicalAssignmentBytes({
        roleId: input.roleId,
        assigner: input.assigner,
        workspaceId: input.workspaceId,
        cwd: input.cwd,
        envelope,
        createdAt,
      }),
    ),
    roleId: input.roleId,
    disposition: envelope.disposition,
    assigner: input.assigner,
    workspaceId: input.workspaceId,
    cwd: input.cwd,
    effectClass: envelope.effectClass,
    mutationBoundary: envelope.mutationBoundary,
    externalEffectBoundary: envelope.externalEffectBoundary,
    ...(envelope.resourceGrants ? { resourceGrants: envelope.resourceGrants } : {}),
    ...(envelope.protocolException
      ? { protocolExceptionExpiresAt: envelope.protocolException.expiresAt }
      : {}),
    createdAt,
    ...(envelope.expiresAt ? { expiresAt: envelope.expiresAt } : {}),
  };
  return PersistedAssignmentContractSchema.parse({ receipt, envelope });
}

/** Pure admission used before any workspace, worktree, provider, or storage side effect. */
export function preflightAssignmentEnvelope(input: {
  roleId: PaseoRoleId;
  envelope: AssignmentEnvelope | undefined;
  createdAt?: Date;
}): AssignmentEnvelope {
  if (!input.envelope) {
    throw new Error(ASSIGNMENT_CONTRACT_REQUIRED_ERROR);
  }
  const envelope = AssignmentEnvelopeSchema.parse(input.envelope);
  const now = input.createdAt ?? new Date();
  requireFuture(envelope.protocolException?.expiresAt, now, "protocolException.expiresAt");
  requireFuture(envelope.expiresAt, now, "expiresAt");
  return envelope;
}
