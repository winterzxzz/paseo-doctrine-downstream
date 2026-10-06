import type {
  AssignmentDisposition,
  AssignmentEffectClass,
} from "@getpaseo/protocol/assignment-contract";
import type { PaseoRoleId, RoleBindingInjectionMethod } from "@getpaseo/protocol/role-binding";

import type {
  AgentPermissionRequest,
  AgentPermissionResponse,
  AgentSessionConfig,
} from "./agent-sdk-types.js";
import type { PersistedRoleBinding } from "./role-binding.js";
import { ROLE_TOOL_CEILINGS } from "../policy/bundled/slp/role-profiles.js";
import { getUnattendedModeId } from "@getpaseo/protocol/provider-manifest";

export const ASSIGNMENT_CAPABILITY_BOUNDARY_ERROR = "assignment_capability_boundary_required";

/**
 * Downstream override: when enabled (the default), the daemon picks each
 * agent's runtime permission mode from the Human per-role policy in
 * resolveRuntimePermissionPolicy instead of from the assignment's mutation
 * boundary alone. Set PASEO_FORCE_BYPASS=0 to restore upstream enforcement,
 * where every no-write assignment is pinned and everything else keeps the
 * requested mode.
 */
export const FORCE_AGENT_BYPASS = process.env.PASEO_FORCE_BYPASS !== "0";

/**
 * - `bypass`: provider unattended mode ("Bypass"/"Full Access"); no mode lock.
 * - `no-write`: provider-enforced no-write mode, locked; `allow` responses refused.
 * - `ask`: the same guarded provider mode, but Human may approve individual requests.
 * - `provider-default`: keep the requested mode (upstream, write-authorized).
 */
export type RuntimePermissionPolicy = "bypass" | "no-write" | "ask" | "provider-default";

export interface RuntimePermissionSubject {
  roleId: PaseoRoleId;
  disposition?: AssignmentDisposition;
  effectClass?: AssignmentEffectClass;
  mutationMode?: "no-write" | "bounded-write";
  executionProfileId?: string;
}

const REVIEWER_EXECUTION_PROFILE_IDS = new Set(["reviewer", "review"]);

function isReviewerPeer(subject: RuntimePermissionSubject): boolean {
  return (
    subject.disposition === "independent-review" ||
    (subject.executionProfileId !== undefined &&
      REVIEWER_EXECUTION_PROFILE_IDS.has(subject.executionProfileId))
  );
}

/**
 * Human runtime policy: Lead always bypass; Peer bypass except a reviewer, which is
 * pinned no-write; Supervisor read-only (observer) pinned no-write, delegation
 * (coordination) in the guarded ask mode, bootstrap/recovery bypass.
 */
export function resolveRuntimePermissionPolicy(
  subject: RuntimePermissionSubject,
  forceBypass: boolean = FORCE_AGENT_BYPASS,
): RuntimePermissionPolicy {
  if (!forceBypass) {
    return subject.mutationMode === "no-write" ? "no-write" : "provider-default";
  }
  switch (subject.roleId) {
    case "lead":
      return "bypass";
    case "peer":
      return isReviewerPeer(subject) ? "no-write" : "bypass";
    case "supervisor":
      if (subject.effectClass === "read-only") return "no-write";
      if (subject.effectClass === "delegation") return "ask";
      return "bypass";
  }
}

export function runtimePermissionPolicyForBinding(
  roleBinding: PersistedRoleBinding | undefined,
  forceBypass: boolean = FORCE_AGENT_BYPASS,
): RuntimePermissionPolicy {
  if (!roleBinding) {
    return forceBypass ? "bypass" : "provider-default";
  }
  const assignment = roleBinding.assignment;
  return resolveRuntimePermissionPolicy(
    {
      roleId: roleBinding.roleId,
      disposition: assignment?.disposition,
      effectClass: assignment?.effectClass,
      mutationMode: assignment?.mutationBoundary.mode,
      executionProfileId: roleBinding.executionProfile?.id,
    },
    forceBypass,
  );
}

/**
 * Force a session config to its provider's unattended mode. Returns the config
 * unchanged when the provider exposes no unattended mode.
 */
export function forceUnattendedSessionMode(config: AgentSessionConfig): AgentSessionConfig {
  const unattendedModeId = getUnattendedModeId(config.provider);
  return unattendedModeId ? { ...config, modeId: unattendedModeId } : config;
}

const NO_WRITE_MODE_BY_INJECTION_METHOD: Partial<Record<RoleBindingInjectionMethod, string>> = {
  "codex-developer-instructions": "read-only",
  // Claude plan mode injects a planning workflow that tells the model to avoid
  // every state-changing call, including exact daemon-preapproved Paseo Room
  // coordination. The adapter enforces no-write independently with a strict
  // built-in tools allowlist plus explicit write-tool denies, so pin the
  // guarded default mode and keep the model out of the Plan workflow.
  "claude-system-prompt": "default",
  "cursor-project-rule-capsule": "plan",
  "cursor-always-apply-plugin": "plan",
  "antigravity-custom-agent": "plan",
  // Droid "normal" (Auto Off) auto-approves only reads; every other action reaches the
  // permission gate, which refuses `allow` for a no-write session.
  "droid-home-capsule": "normal",
  "mock-launch-context": "read-only",
};

/** The guarded provider mode used by both the `no-write` and `ask` policies. */
export function noWriteModeForInjectionMethod(
  injectionMethod: RoleBindingInjectionMethod,
): string | null {
  return NO_WRITE_MODE_BY_INJECTION_METHOD[injectionMethod] ?? null;
}

export function isNoWriteRuntime(roleBinding: PersistedRoleBinding | undefined): boolean {
  return runtimePermissionPolicyForBinding(roleBinding) === "no-write";
}

function guardedModeForBinding(roleBinding: PersistedRoleBinding): string {
  const modeId = noWriteModeForInjectionMethod(roleBinding.injectionMethod);
  if (!modeId) {
    throw new Error(
      `${ASSIGNMENT_CAPABILITY_BOUNDARY_ERROR}: provider injection '${roleBinding.injectionMethod}' has no qualified no-write mode for ${roleBinding.roleId} assignment`,
    );
  }
  return modeId;
}

export function requiredNoWriteMode(roleBinding: PersistedRoleBinding | undefined): string | null {
  if (!roleBinding || !isNoWriteRuntime(roleBinding)) {
    return null;
  }
  return guardedModeForBinding(roleBinding);
}

/** Apply the runtime permission policy to a launch config. */
export function enforceRoleAssignmentCapability(
  config: AgentSessionConfig,
  roleBinding: PersistedRoleBinding | undefined,
  forceBypass: boolean = FORCE_AGENT_BYPASS,
): AgentSessionConfig {
  const policy = runtimePermissionPolicyForBinding(roleBinding, forceBypass);
  if (policy === "bypass") {
    return forceUnattendedSessionMode(config);
  }
  if (policy === "provider-default" || !roleBinding) {
    return config;
  }
  const modeId = guardedModeForBinding(roleBinding);
  const disablesAutoAccept =
    roleBinding.injectionMethod === "cursor-project-rule-capsule" ||
    roleBinding.injectionMethod === "cursor-always-apply-plugin";
  return {
    ...config,
    modeId,
    ...(disablesAutoAccept
      ? {
          featureValues: {
            ...config.featureValues,
            auto_accept: false,
          },
        }
      : {}),
  };
}

export function assertRoleAssignmentModeAllowed(
  roleBinding: PersistedRoleBinding | undefined,
  requestedModeId: string,
): void {
  const requiredModeId = requiredNoWriteMode(roleBinding);
  if (requiredModeId && requestedModeId !== requiredModeId) {
    throw new Error(
      `${ASSIGNMENT_CAPABILITY_BOUNDARY_ERROR}: no-write ${roleBinding?.roleId ?? "role"} assignment is pinned to provider mode '${requiredModeId}'`,
    );
  }
}

export function assertRoleAssignmentPermissionResponseAllowed(
  roleBinding: PersistedRoleBinding | undefined,
  response: AgentPermissionResponse,
  request?: AgentPermissionRequest,
  context: { onlyRuntimePaseoMcp?: boolean } = {},
): void {
  const isExactCursorPaseoToolConsent = (() => {
    if (
      roleBinding?.injectionMethod !== "cursor-project-rule-capsule" &&
      roleBinding?.injectionMethod !== "cursor-always-apply-plugin"
    ) {
      return false;
    }
    if (request?.kind !== "tool") return false;
    const admittedTools =
      roleBinding.roleProfile?.allowedTools ?? ROLE_TOOL_CEILINGS[roleBinding.roleId];
    return admittedTools.some((toolName) => {
      const exactTransportName = `paseo-${toolName}`;
      return request.name === exactTransportName || request.title === exactTransportName;
    });
  })();
  const isRoleScopedOpaqueCursorPaseoConsent =
    (roleBinding?.injectionMethod === "cursor-project-rule-capsule" ||
      roleBinding?.injectionMethod === "cursor-always-apply-plugin") &&
    request?.kind === "tool" &&
    request.metadata?.transportShadow === "cursor-opaque-mcp" &&
    context.onlyRuntimePaseoMcp === true;
  const isQuestionResponse = request?.kind === "question";
  if (
    isNoWriteRuntime(roleBinding) &&
    response.behavior === "allow" &&
    !isQuestionResponse &&
    !isExactCursorPaseoToolConsent &&
    !isRoleScopedOpaqueCursorPaseoConsent
  ) {
    throw new Error(
      `${ASSIGNMENT_CAPABILITY_BOUNDARY_ERROR}: no-write ${roleBinding?.roleId ?? "role"} assignment cannot approve a permission escalation`,
    );
  }
}
