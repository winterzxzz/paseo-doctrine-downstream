import { describe, expect, test } from "vitest";
import type { AssignmentEnvelope } from "@getpaseo/protocol/assignment-contract";
import {
  ASSIGNMENT_CONTRACT_INVALID_ERROR,
  ASSIGNMENT_CONTRACT_REQUIRED_ERROR,
  materializeAssignmentContract,
  withRoleDefaultExternalEffectLease,
} from "./assignment-contract.js";
import {
  buildSlpAssignmentInstruction,
  preflightSlpAssignmentEnvelope,
} from "../policy/bundled/slp/assignment-policy.js";

const now = new Date("2026-08-08T00:00:00.000Z");

function envelope(overrides: Partial<AssignmentEnvelope> = {}): AssignmentEnvelope {
  return {
    version: 1,
    disposition: "lead-direct",
    objective: "Inspect the repository without mutation.",
    effectClass: "read-only",
    mutationBoundary: { mode: "no-write" },
    externalEffectBoundary: { mode: "denied" },
    evidence: "Return exact inspected paths.",
    handbackAndStop: "Stop after the evidence handback.",
    ...overrides,
  };
}

function materialize(input: {
  envelope?: AssignmentEnvelope;
  assigner?: { kind: "human-session" } | { kind: "agent"; agentId: string };
  roleId?: "lead" | "peer" | "supervisor";
}) {
  const roleId = input.roleId ?? "lead";
  return materializeAssignmentContract({
    roleId,
    assigner: input.assigner ?? { kind: "human-session" },
    workspaceId: "workspace-1",
    cwd: "/repo",
    envelope: preflightSlpAssignmentEnvelope({
      roleId,
      envelope: input.envelope,
      createdAt: now,
    }),
    createdAt: now,
  });
}

describe("immutable assignment contract", () => {
  test("materializes a stable receipt and durable authority instruction", () => {
    const contract = materialize({
      envelope: envelope({ resourceGrants: { beadsIssueIds: ["ps123-abc"] } }),
    });

    expect(contract.receipt).toMatchObject({
      roleId: "lead",
      assigner: { kind: "human-session" },
      effectClass: "read-only",
      mutationBoundary: { mode: "no-write" },
      resourceGrants: { beadsIssueIds: ["ps123-abc"] },
      createdAt: now.toISOString(),
    });
    expect(contract.receipt.assignmentDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(buildSlpAssignmentInstruction(contract)).toContain("Mutation boundary: no-write");
    // Human runtime policy: a Lead always runs bypass and keeps the no-write lease itself.
    expect(buildSlpAssignmentInstruction(contract)).toContain(
      "the no-write mutation boundary above still binds",
    );
    expect(buildSlpAssignmentInstruction(contract)).toContain("Beads issue grants: ps123-abc");
    expect(buildSlpAssignmentInstruction(contract)).toContain(
      "Mandatory Beads Central checkpoint: call beads_status",
    );
  });

  test("accepts an RFC 3339 offset timestamp for assignment expiry", () => {
    const contract = materialize({
      envelope: envelope({ expiresAt: "2026-08-08T08:00:00+07:00" }),
    });

    expect(contract.receipt.expiresAt).toBe("2026-08-08T08:00:00+07:00");
  });

  test("injects role-specific mandatory tracker behavior", () => {
    const peer = materialize({
      roleId: "peer",
      envelope: envelope({
        disposition: "peer-execution",
        resourceGrants: { beadsIssueIds: ["ps123-abc"] },
      }),
    });
    const supervisor = materialize({
      roleId: "supervisor",
      envelope: envelope({ disposition: "supervision" }),
    });
    const delegatingSupervisor = materialize({
      roleId: "supervisor",
      envelope: envelope({ disposition: "supervision", effectClass: "delegation" }),
    });

    const mutatingPeer = materialize({
      roleId: "peer",
      envelope: envelope({
        disposition: "peer-execution",
        effectClass: "mutating",
        mutationBoundary: { mode: "bounded-write", scope: "/repo" },
        externalEffectBoundary: { mode: "bounded", scope: "Beads Central" },
        resourceGrants: { beadsIssueIds: ["ps123-abc"] },
      }),
    });

    expect(buildSlpAssignmentInstruction(peer)).toContain("This lease cannot mutate Beads");
    expect(buildSlpAssignmentInstruction(mutatingPeer)).toContain(
      "Claim the granted issue (beads_claim) before owned mutation",
    );
    expect(buildSlpAssignmentInstruction(mutatingPeer)).toContain("never close");
    expect(buildSlpAssignmentInstruction(peer)).toContain(
      "never guess or hard-code an MCP namespace",
    );
    expect(buildSlpAssignmentInstruction(peer)).toContain(
      "Only an authoritative Paseo tool receipt counts",
    );
    expect(buildSlpAssignmentInstruction(supervisor)).toContain("Remain read-only");
    expect(buildSlpAssignmentInstruction(supervisor)).toContain("material handoff");
    expect(buildSlpAssignmentInstruction(delegatingSupervisor)).toContain(
      "create and prompt only your own direct role-bound Lead children",
    );
  });

  test("keeps a read-only Lead inspecting when Central is unavailable and blocks a mutating Lead", () => {
    const readOnlyLead = materialize({ envelope: envelope() });
    const mutatingLead = materialize({
      envelope: envelope({
        objective: "Apply the bounded fix.",
        effectClass: "mutating",
        mutationBoundary: { mode: "bounded-write", scope: "/repo" },
        externalEffectBoundary: {
          mode: "bounded",
          scope:
            "Beads Central issue/work graph for this assignment only; no other external effects",
        },
      }),
    });

    const readOnlyText = buildSlpAssignmentInstruction(readOnlyLead);
    expect(readOnlyText).toContain("continue only the no-write inspection");
    expect(readOnlyText).toContain("report issue state UNKNOWN");
    expect(readOnlyText).not.toContain("report BLOCKED");

    const mutatingText = buildSlpAssignmentInstruction(mutatingLead);
    expect(mutatingText).toContain("If Central is unavailable, report BLOCKED");
    expect(mutatingText).toContain("close only after your engineering verdict");
  });

  test("projects the lease actually granted, not the role default, into the tracker checkpoint", () => {
    const deniedMutatingLead = materialize({
      envelope: envelope({
        effectClass: "mutating",
        mutationBoundary: { mode: "bounded-write", scope: "/repo" },
        externalEffectBoundary: { mode: "denied" },
      }),
    });
    const boundedMutatingLead = materialize({
      envelope: envelope({
        effectClass: "mutating",
        mutationBoundary: { mode: "bounded-write", scope: "/repo" },
        externalEffectBoundary: { mode: "bounded", scope: "Beads Central" },
      }),
    });

    const deniedText = buildSlpAssignmentInstruction(deniedMutatingLead);
    expect(deniedText).not.toContain("Inspect or create");
    expect(deniedText).toContain("this lease cannot create, claim, update or close issues");

    const boundedText = buildSlpAssignmentInstruction(boundedMutatingLead);
    expect(boundedText).toContain("Inspect or create (beads_create) the durable issue");
    expect(boundedText).toContain("leave it open and unassigned");
  });

  test("fills the role-default Beads lease into an agent-authored denied envelope", () => {
    const mutating = envelope({
      effectClass: "mutating",
      mutationBoundary: { mode: "bounded-write", scope: "/repo" },
    });

    expect(withRoleDefaultExternalEffectLease("lead", mutating).externalEffectBoundary).toEqual({
      mode: "bounded",
      scope: "Beads Central issue/work graph for this assignment only; no other external effects",
    });
    expect(
      withRoleDefaultExternalEffectLease("peer", { ...mutating, disposition: "peer-execution" })
        .externalEffectBoundary.mode,
    ).toBe("bounded");
    expect(withRoleDefaultExternalEffectLease("lead", envelope()).externalEffectBoundary).toEqual({
      mode: "denied",
    });
    expect(
      withRoleDefaultExternalEffectLease("supervisor", {
        ...envelope(),
        disposition: "supervision",
        effectClass: "delegation",
      }).externalEffectBoundary,
    ).toEqual({ mode: "denied" });
    const ownScope = { ...mutating, externalEffectBoundary: { mode: "bounded", scope: "npm" } };
    expect(
      withRoleDefaultExternalEffectLease("lead", ownScope as AssignmentEnvelope)
        .externalEffectBoundary,
    ).toEqual({ mode: "bounded", scope: "npm" });
  });

  test("renders rationale and open assumptions only when the envelope carries them", () => {
    const bare = buildSlpAssignmentInstruction(materialize({ envelope: envelope() }));
    expect(bare).not.toContain("Rationale:");
    expect(bare).not.toContain("Open assumptions:");

    const framed = buildSlpAssignmentInstruction(
      materialize({
        envelope: envelope({
          rationale: "The browser must learn call state early enough to ring.",
          openAssumptions: "WebSocket is the candidate transport; SSE plus HTTP may suffice.",
        }),
      }),
    );
    expect(framed).toContain(
      "Objective: Inspect the repository without mutation.\nRationale: The browser must learn call state early enough to ring.\nOpen assumptions: WebSocket is the candidate transport; SSE plus HTTP may suffice.\nMutation boundary: no-write",
    );
  });

  test("requires an issue grant only for a mutating Peer", () => {
    expect(
      materialize({
        roleId: "peer",
        envelope: envelope({ disposition: "peer-execution" }),
      }).envelope.resourceGrants,
    ).toBeUndefined();
    expect(() =>
      materialize({
        roleId: "peer",
        envelope: envelope({
          disposition: "peer-execution",
          effectClass: "mutating",
          mutationBoundary: { mode: "bounded-write", scope: "/repo" },
          externalEffectBoundary: {
            mode: "bounded",
            scope:
              "Beads Central issue/work graph for this assignment only; no other external effects",
          },
        }),
      }),
    ).toThrow("mutating Peer requires an exact Beads issue grant");
  });

  test("fails closed when a role-bound create omits the assignment", () => {
    expect(() => materialize({})).toThrow(ASSIGNMENT_CONTRACT_REQUIRED_ERROR);
  });

  test("rejects contradictory effect boundaries", () => {
    expect(() =>
      materialize({
        envelope: envelope({
          effectClass: "read-only",
          mutationBoundary: { mode: "bounded-write", scope: "src/**" },
        }),
      }),
    ).toThrow(`${ASSIGNMENT_CONTRACT_INVALID_ERROR}: read-only requires no-write`);
    expect(() =>
      materialize({
        envelope: envelope({
          effectClass: "delegation",
          mutationBoundary: { mode: "bounded-write", scope: "src/**" },
        }),
      }),
    ).toThrow(`${ASSIGNMENT_CONTRACT_INVALID_ERROR}: delegation requires no-write`);
  });

  test("rejects an external-effect lease that contradicts the role and effect", () => {
    expect(() =>
      materialize({
        roleId: "peer",
        envelope: envelope({
          disposition: "independent-review",
          resourceGrants: { beadsIssueIds: ["ps123-abc"] },
          externalEffectBoundary: {
            mode: "bounded",
            scope: "Beads Central update to the granted issue only",
          },
        }),
      }),
    ).toThrow(
      `${ASSIGNMENT_CONTRACT_INVALID_ERROR}: peer read-only requires external effects denied`,
    );
  });

  test("permits an exact bounded bootstrap write", () => {
    expect(
      materialize({
        envelope: envelope({
          effectClass: "bootstrap",
          mutationBoundary: {
            mode: "bounded-write",
            scope: "/repo/WORKSPACE_PROTOCOL.md",
          },
        }),
      }).receipt.mutationBoundary,
    ).toEqual({ mode: "bounded-write", scope: "/repo/WORKSPACE_PROTOCOL.md" });
  });

  test("rejects effects that contradict standing role authority", () => {
    expect(() =>
      materialize({
        roleId: "peer",
        envelope: envelope({
          disposition: "peer-execution",
          effectClass: "delegation",
        }),
      }),
    ).toThrow("effect 'delegation' is not allowed for role 'peer'");
    expect(() =>
      materialize({
        roleId: "supervisor",
        envelope: envelope({
          disposition: "supervision",
          effectClass: "mutating",
          mutationBoundary: { mode: "bounded-write", scope: "/repo" },
        }),
      }),
    ).toThrow("effect 'mutating' is not allowed for role 'supervisor'");
  });

  test("rejects an agent-issued or expired protocol exception", () => {
    const withException = envelope({
      protocolException: {
        reason: "Bootstrap inspection",
        scope: "/repo",
        expiresAt: "2026-08-08T01:00:00.000Z",
      },
    });
    expect(() =>
      materialize({
        envelope: withException,
        assigner: { kind: "agent", agentId: "agent-1" },
      }),
    ).toThrow("protocol exception requires Human session issuer");
    expect(() =>
      materialize({
        envelope: envelope({
          protocolException: {
            reason: "Bootstrap inspection",
            scope: "/repo",
            expiresAt: "2026-08-07T23:59:59.000Z",
          },
        }),
      }),
    ).toThrow("protocolException.expiresAt must be in the future");
  });

  test("rejects a protocol exception for a different workspace scope", () => {
    expect(() =>
      materialize({
        envelope: envelope({
          protocolException: {
            reason: "Bootstrap inspection",
            scope: "/another-repo",
            expiresAt: "2026-08-08T01:00:00.000Z",
          },
        }),
      }),
    ).toThrow("protocol exception scope must equal assignment cwd");
  });
});
