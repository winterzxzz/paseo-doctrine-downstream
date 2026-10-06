import { expect, test } from "vitest";

import type { AgentSessionConfig } from "./agent-sdk-types.js";
import {
  assertRoleAssignmentModeAllowed,
  assertRoleAssignmentPermissionResponseAllowed,
  enforceRoleAssignmentCapability,
  requiredNoWriteMode,
  runtimePermissionPolicyForBinding,
} from "./assignment-capability-boundary.js";
import type { PersistedRoleBinding } from "./role-binding.js";

function roleBinding(input: {
  injectionMethod: PersistedRoleBinding["injectionMethod"];
  mutationMode?: "no-write" | "bounded-write";
}): PersistedRoleBinding {
  const mutationMode = input.mutationMode ?? "no-write";
  // A reviewer Peer is pinned no-write under both the downstream role policy and
  // upstream enforcement, so these cases do not depend on PASEO_FORCE_BYPASS.
  return {
    roleId: "peer",
    injectionMethod: input.injectionMethod,
    assignment: {
      disposition: "independent-review",
      effectClass: mutationMode === "no-write" ? "read-only" : "mutating",
      mutationBoundary:
        mutationMode === "no-write"
          ? { mode: "no-write" }
          : { mode: "bounded-write", scope: "src/**" },
    },
  } as PersistedRoleBinding;
}

function subjectBinding(input: {
  roleId: PersistedRoleBinding["roleId"];
  disposition: "lead-direct" | "peer-execution" | "independent-review" | "supervision";
  effectClass: "read-only" | "mutating" | "delegation" | "bootstrap" | "recovery";
  executionProfileId?: string;
}): PersistedRoleBinding {
  const noWrite = input.effectClass === "read-only" || input.effectClass === "delegation";
  return {
    roleId: input.roleId,
    injectionMethod: "claude-system-prompt",
    ...(input.executionProfileId ? { executionProfile: { id: input.executionProfileId } } : {}),
    assignment: {
      disposition: input.disposition,
      effectClass: input.effectClass,
      mutationBoundary: noWrite ? { mode: "no-write" } : { mode: "bounded-write", scope: "src/**" },
    },
  } as PersistedRoleBinding;
}

test("no-write Codex assignment overrides an unattended full-access request", () => {
  const config: AgentSessionConfig = {
    provider: "codex",
    cwd: "/workspace/repo",
    modeId: "full-access",
  };

  expect(
    enforceRoleAssignmentCapability(
      config,
      roleBinding({ injectionMethod: "codex-developer-instructions" }),
    ),
  ).toMatchObject({ modeId: "read-only" });
});

test("no-write Cursor assignment disables ACP auto-accept and pins plan mode", () => {
  const config: AgentSessionConfig = {
    provider: "cursor",
    cwd: "/workspace/repo",
    modeId: "agent",
    featureValues: { auto_accept: true, fast: true },
  };

  expect(
    enforceRoleAssignmentCapability(
      config,
      roleBinding({ injectionMethod: "cursor-project-rule-capsule" }),
    ),
  ).toMatchObject({ modeId: "plan", featureValues: { auto_accept: false, fast: true } });
});

test("no-write Claude assignment pins guarded default mode for the strict tool boundary", () => {
  const config: AgentSessionConfig = {
    provider: "claude",
    cwd: "/workspace/repo",
    modeId: "bypassPermissions",
  };

  expect(
    enforceRoleAssignmentCapability(
      config,
      roleBinding({ injectionMethod: "claude-system-prompt" }),
    ),
  ).toMatchObject({ modeId: "default" });
});

test.each([
  [
    "lead read-only",
    { roleId: "lead", disposition: "lead-direct", effectClass: "read-only" },
    "bypass",
  ],
  [
    "lead delegation",
    { roleId: "lead", disposition: "lead-direct", effectClass: "delegation" },
    "bypass",
  ],
  [
    "lead mutating",
    { roleId: "lead", disposition: "lead-direct", effectClass: "mutating" },
    "bypass",
  ],
  [
    "peer mutating",
    { roleId: "peer", disposition: "peer-execution", effectClass: "mutating" },
    "bypass",
  ],
  [
    "peer read-only scout",
    { roleId: "peer", disposition: "peer-execution", effectClass: "read-only" },
    "bypass",
  ],
  [
    "peer independent review",
    { roleId: "peer", disposition: "independent-review", effectClass: "read-only" },
    "no-write",
  ],
  [
    "peer reviewer specialization",
    {
      roleId: "peer",
      disposition: "peer-execution",
      effectClass: "mutating",
      executionProfileId: "reviewer",
    },
    "no-write",
  ],
  [
    "peer OCR review specialization",
    {
      roleId: "peer",
      disposition: "peer-execution",
      effectClass: "read-only",
      executionProfileId: "review",
    },
    "no-write",
  ],
  [
    "supervisor observer",
    { roleId: "supervisor", disposition: "supervision", effectClass: "read-only" },
    "no-write",
  ],
  [
    "supervisor coordinator",
    { roleId: "supervisor", disposition: "supervision", effectClass: "delegation" },
    "ask",
  ],
  [
    "supervisor recovery",
    { roleId: "supervisor", disposition: "supervision", effectClass: "recovery" },
    "bypass",
  ],
] as const)("runtime policy: %s -> %s", (_label, subject, expected) => {
  expect(runtimePermissionPolicyForBinding(subjectBinding(subject), true)).toBe(expected);
});

test("upstream enforcement pins every no-write assignment and keeps write-authorized modes", () => {
  expect(
    runtimePermissionPolicyForBinding(
      subjectBinding({ roleId: "lead", disposition: "lead-direct", effectClass: "delegation" }),
      false,
    ),
  ).toBe("no-write");
  expect(
    runtimePermissionPolicyForBinding(
      subjectBinding({ roleId: "peer", disposition: "peer-execution", effectClass: "mutating" }),
      false,
    ),
  ).toBe("provider-default");
});

test("a no-write Lead launches in bypass under the Human role policy", () => {
  const config: AgentSessionConfig = {
    provider: "claude",
    cwd: "/workspace/repo",
    modeId: "default",
  };

  expect(
    enforceRoleAssignmentCapability(
      config,
      subjectBinding({ roleId: "lead", disposition: "lead-direct", effectClass: "delegation" }),
      true,
    ),
  ).toMatchObject({ modeId: "bypassPermissions" });
});

test("a coordinating Supervisor launches in the guarded ask mode", () => {
  const config: AgentSessionConfig = {
    provider: "claude",
    cwd: "/workspace/repo",
    modeId: "bypassPermissions",
  };

  expect(
    enforceRoleAssignmentCapability(
      config,
      subjectBinding({
        roleId: "supervisor",
        disposition: "supervision",
        effectClass: "delegation",
      }),
      true,
    ),
  ).toMatchObject({ modeId: "default" });
});

test("a pinned reviewer cannot switch into bypass mode", () => {
  expect(() =>
    assertRoleAssignmentModeAllowed(
      roleBinding({ injectionMethod: "claude-system-prompt" }),
      "bypassPermissions",
    ),
  ).toThrow("assignment_capability_boundary_required");
});

test("bounded-write assignment preserves the requested provider capability", () => {
  const config: AgentSessionConfig = {
    provider: "claude",
    cwd: "/workspace/repo",
    modeId: "bypassPermissions",
  };

  expect(
    enforceRoleAssignmentCapability(
      config,
      subjectBinding({ roleId: "peer", disposition: "peer-execution", effectClass: "mutating" }),
      false,
    ),
  ).toBe(config);
});

test("no-write assignment fails closed for a provider without a qualified mode", () => {
  expect(() =>
    requiredNoWriteMode(roleBinding({ injectionMethod: "omp-append-system-prompt" })),
  ).toThrow("assignment_capability_boundary_required");
});

test("no-write assignment rejects mode and permission escalation", () => {
  const binding = roleBinding({ injectionMethod: "claude-system-prompt" });

  expect(() => assertRoleAssignmentModeAllowed(binding, "bypassPermissions")).toThrow(
    "pinned to provider mode 'default'",
  );
  expect(() =>
    assertRoleAssignmentPermissionResponseAllowed(binding, { behavior: "allow" }),
  ).toThrow("cannot approve a permission escalation");
  expect(() =>
    assertRoleAssignmentPermissionResponseAllowed(binding, { behavior: "deny" }),
  ).not.toThrow();
});

test("no-write assignment permits answering a provider question without granting capability", () => {
  const binding = roleBinding({ injectionMethod: "claude-system-prompt" });

  expect(() =>
    assertRoleAssignmentPermissionResponseAllowed(
      binding,
      { behavior: "allow", updatedInput: { answers: { decision: "stop" } } },
      {
        id: "permission-question",
        provider: "claude",
        name: "AskUserQuestion",
        kind: "question",
        title: "Choose how to continue",
        actions: [],
      },
    ),
  ).not.toThrow();
});

test("no-write Cursor assignment permits exact role-ceiling Paseo MCP transport consent", () => {
  const binding = {
    ...roleBinding({ injectionMethod: "cursor-project-rule-capsule" }),
    roleId: "supervisor",
  } as PersistedRoleBinding;

  expect(() =>
    assertRoleAssignmentPermissionResponseAllowed(
      binding,
      { behavior: "allow" },
      {
        id: "permission-1",
        provider: "cursor",
        name: "paseo-beads_status",
        kind: "tool",
        title: "paseo-beads_status",
        actions: [],
      },
    ),
  ).not.toThrow();
  expect(() =>
    assertRoleAssignmentPermissionResponseAllowed(
      binding,
      { behavior: "allow" },
      {
        id: "permission-2",
        provider: "cursor",
        name: "run_terminal_command",
        kind: "tool",
        title: "Run terminal command",
        actions: [],
      },
    ),
  ).toThrow("cannot approve a permission escalation");
});

test("no-write Cursor assignment rejects a tool omitted from the immutable role profile", () => {
  const binding = {
    ...roleBinding({ injectionMethod: "cursor-project-rule-capsule" }),
    roleId: "supervisor",
    roleProfile: {
      schemaVersion: 1,
      profileDigest: "a".repeat(64),
      defaults: {},
      allowedTools: ["beads_status"],
      allowedSkills: ["beads-issue-tracker"],
    },
  } as PersistedRoleBinding;

  expect(() =>
    assertRoleAssignmentPermissionResponseAllowed(
      binding,
      { behavior: "allow" },
      {
        id: "permission-disabled-tool",
        provider: "cursor",
        name: "paseo-read_room",
        kind: "tool",
        title: "paseo-read_room",
        actions: [],
      },
    ),
  ).toThrow("cannot approve a permission escalation");
});

test("no-write Cursor assignment permits opaque MCP consent only for the role-scoped Paseo server", () => {
  const binding = {
    ...roleBinding({ injectionMethod: "cursor-project-rule-capsule" }),
    roleId: "supervisor",
  } as PersistedRoleBinding;
  const request = {
    id: "permission-opaque-mcp",
    provider: "cursor",
    name: "other",
    kind: "tool" as const,
    title: "MCP: tool",
    actions: [],
    metadata: { transportShadow: "cursor-opaque-mcp" },
  };

  expect(() =>
    assertRoleAssignmentPermissionResponseAllowed(binding, { behavior: "allow" }, request, {
      onlyRuntimePaseoMcp: true,
    }),
  ).not.toThrow();
  expect(() =>
    assertRoleAssignmentPermissionResponseAllowed(binding, { behavior: "allow" }, request, {
      onlyRuntimePaseoMcp: false,
    }),
  ).toThrow("cannot approve a permission escalation");
});
