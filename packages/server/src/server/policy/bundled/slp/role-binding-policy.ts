import type {
  PaseoRoleId,
  RoleProfileBindingReceipt,
  WorkspaceProtocolBindingReceipt,
} from "@getpaseo/protocol/role-binding";

import {
  buildSlpAssignmentInstruction,
  preflightSlpAssignmentEnvelope,
} from "./assignment-policy.js";
import {
  foundationExecutionProfileDefinitionDigest,
  getFoundationExecutionProfileDefinition,
  type FoundationExecutionProfileId,
} from "./execution-profiles.js";
import { getFoundationRoleDefinition } from "./role-definitions.js";
import { materializeRoleProfileBindingReceipt } from "./role-profiles.js";
import { loadFoundationSkillPolicy } from "./skill-policy.js";
import type { ApprovedPeerRoster } from "../../../agent/peer-roster.js";
import type {
  RoleBindingInstructionCompositionInput,
  RoleBindingPolicyContribution,
} from "../../role-binding-policy.js";

function workspaceProtocolReadership(
  roleId: PaseoRoleId,
): WorkspaceProtocolBindingReceipt["readership"] {
  return getFoundationRoleDefinition(roleId).protocolReadership;
}

function buildProtocolInstruction(
  receipt: WorkspaceProtocolBindingReceipt,
  hasProtocolException: boolean,
): string {
  if (receipt.status === "missing") {
    if (!hasProtocolException) {
      return `Workspace Protocol binding: not yet bootstrapped at ${receipt.path}. This assignment was admitted because it declares no write scope and no external effects. Treat the repository's coordination tactics as unknown rather than absent, stay non-mutating, and report that the protocol still needs bootstrapping at handback. Any write scope or external effect requires a bound protocol or an exact Human exception first.`;
    }
    if (receipt.readership === "assignment-only") {
      return `Workspace Protocol binding: temporarily missing under an exact Human bootstrap exception at ${receipt.path}. Do not load that path; remain inside the read-only/bootstrap assignment and stop at its expiry.`;
    }
    if (receipt.readership === "governance-only") {
      return `Workspace Protocol binding: temporarily missing under an exact Human governance exception at ${receipt.path}. Create, audit, or update it only inside that bounded mandate and stop at its expiry.`;
    }
    return `Workspace Protocol binding: temporarily missing under an exact Human bootstrap exception at ${receipt.path}. Bootstrap only the bounded governance artifact and stop at the assignment expiry.`;
  }
  if (receipt.readership === "assignment-only") {
    return `Workspace Protocol binding: assignment-only. Do not load ${receipt.path}; receive only relevant constraints in the Lead assignment.`;
  }
  if (receipt.readership === "governance-only") {
    return `Workspace Protocol binding: governance-only at ${receipt.path}. Read it only when the exact Human mandate requires protocol create/audit/update. Bound status: ${receipt.status}${receipt.digest ? `; sha256=${receipt.digest}` : ""}.`;
  }
  return `Workspace Protocol binding: full-read required at ${receipt.path}; sha256=${receipt.digest}. Read the exact current file before orchestration. If current bytes no longer match this digest, stop and request a fresh binding instead of relying on stale protocol state.`;
}

function buildBeadsSkillAdmissionInstruction(
  roleId: PaseoRoleId,
  roleProfile: RoleProfileBindingReceipt,
): string {
  const policy = loadFoundationSkillPolicy(roleId);
  const skillPath = policy.skillPaths.get("beads-issue-tracker");
  if (
    policy.status !== "bound" ||
    !policy.enabledNames.has("beads-issue-tracker") ||
    !roleProfile.allowedSkills.includes("beads-issue-tracker") ||
    !skillPath
  ) {
    throw new Error(
      "foundation_skill_admission_required: beads-issue-tracker is not bound for this role",
    );
  }
  return "Role skill admission: `beads-issue-tracker` is active from the immutable Foundation bundle. Its assignment-start checkpoint, mutation boundary, and handback rule are projected in the Assignment Contract above; do not search for or load a second copy.";
}

const PEER_ROSTER_NOTE_LIMIT = 200;

function describeRosterProfile(profile: ApprovedPeerRoster["profiles"][number]): string {
  const route = profile.model ? `${profile.provider}/${profile.model}` : profile.provider;
  const parts = [`\`${profile.id}\` (${profile.name})`, route];
  if (profile.peerSubrole) parts.push(`subrole ${profile.peerSubrole}`);
  const notes = profile.notes?.trim().replace(/\s+/gu, " ");
  if (notes) {
    parts.push(
      notes.length > PEER_ROSTER_NOTE_LIMIT
        ? `${notes.slice(0, PEER_ROSTER_NOTE_LIMIT - 1)}…`
        : notes,
    );
  }
  return `- ${parts.join(" · ")}`;
}

/**
 * Leads route Peer work and Supervisors audit that routing; neither can do either job
 * without knowing which Peers exist, so the Human-approved roster rides in the binding.
 */
function buildPeerRosterInstruction(
  roleId: PaseoRoleId,
  roster: ApprovedPeerRoster | null,
): string | null {
  if (roleId === "peer") return null;
  const usage =
    roleId === "lead"
      ? "Pass an exact id as create_agent.launchProfileId, or omit it to get the default subrole. Do not route Peer work to anything outside this roster."
      : "You never launch Peers. Use this roster to check that each Lead routes Peer work only through these profiles, and flag any Lead whose Peers fall outside it.";
  if (!roster) {
    return `Peer roster: no Human-approved Peer allowlist is configured. Call list_profiles before ${roleId === "lead" ? "creating" : "auditing"} any Peer; if it returns nothing, Peer delegation is unavailable${roleId === "lead" ? ", so do the work lead-direct or report BLOCKED" : ""}.`;
  }
  if (!roster.enabled || roster.profiles.length === 0) {
    return `Peer roster: Peer delegation is disabled or has no approved profiles.${roleId === "lead" ? " Do not create Peers; do the work lead-direct or report BLOCKED." : " Any Lead-created Peer is outside Human policy."}`;
  }
  const header = [
    "Peer roster (Human-approved, snapshot at launch; list_profiles returns the current one):",
    `default subrole ${roster.defaultSubrole ?? "none"}; provider priority ${roster.providerPriority.join(" > ") || "none"}.`,
  ].join(" ");
  return [header, ...roster.profiles.map(describeRosterProfile), usage].join("\n");
}

function composeInstructions(input: RoleBindingInstructionCompositionInput): string {
  return [
    input.definition.instructions,
    input.executionProfile?.instructions,
    buildProtocolInstruction(input.workspaceProtocol, input.hasProtocolException),
    buildSlpAssignmentInstruction(input.assignmentContract, input.executionProfile?.id),
    buildPeerRosterInstruction(input.definition.id, input.peerRoster),
    buildBeadsSkillAdmissionInstruction(input.definition.id, input.roleProfile),
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
}

export const SLP_ROLE_BINDING_POLICY: RoleBindingPolicyContribution<FoundationExecutionProfileId> =
  {
    getRoleDefinition: getFoundationRoleDefinition,
    getExecutionProfile: getFoundationExecutionProfileDefinition,
    executionProfileDefinitionDigest: foundationExecutionProfileDefinitionDigest,
    materializeRoleProfile: (roleId, preferences, assignmentEffectClass) =>
      materializeRoleProfileBindingReceipt(roleId, preferences, assignmentEffectClass),
    workspaceProtocolReadership,
    composeInstructions,
    preflight(input) {
      const envelope = preflightSlpAssignmentEnvelope({
        roleId: input.roleId,
        envelope: input.assignment,
        createdAt: input.createdAt,
      });
      if (input.executionProfileId) {
        const executionProfile = getFoundationExecutionProfileDefinition(input.executionProfileId);
        if (executionProfile.authorityRoleId !== input.roleId) {
          throw new Error(
            `Execution profile '${executionProfile.id}' requires role '${executionProfile.authorityRoleId}'`,
          );
        }
      }
      return envelope;
    },
  };
