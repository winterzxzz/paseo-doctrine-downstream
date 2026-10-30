import { describe, expect, it } from "vitest";
import {
  resolveDefaultAssignmentEffect,
  resolveRoleDraftDefaults,
  withDefaultLeadRoute,
  withRoleLaunchDefaults,
} from "./role-defaults";

describe("role defaults", () => {
  const config = {
    leadRoutes: ["claude/claude-opus-5-5", "factory-droid/claude-opus-5-5"],
    roleDefaults: {
      supervisor: { route: "claude/claude-fable-5-1", thinkingOptionId: "high" },
      lead: { thinkingOptionId: "max" },
    },
  };

  it("gives a Supervisor its own route and a Lead the first Lead route", () => {
    expect(resolveRoleDraftDefaults(config, "supervisor")).toEqual({
      provider: "claude",
      model: "claude-fable-5-1",
      thinkingOptionId: "high",
    });
    expect(resolveRoleDraftDefaults(config, "lead")).toEqual({
      provider: "claude",
      model: "claude-opus-5-5",
      thinkingOptionId: "max",
    });
    expect(resolveRoleDraftDefaults(config, "peer")).toBeNull();
    expect(
      resolveRoleDraftDefaults({ roleDefaults: { lead: { thinkingOptionId: "max" } } }, "lead"),
    ).toBeNull();
  });

  it("makes a route the default Lead route and keeps the rest as fallbacks", () => {
    expect(withDefaultLeadRoute(config.leadRoutes, "factory-droid/claude-opus-5-5")).toEqual([
      "factory-droid/claude-opus-5-5",
    ]);
    expect(withDefaultLeadRoute(config.leadRoutes, "codex/gpt-6")).toEqual([
      "codex/gpt-6",
      "factory-droid/claude-opus-5-5",
    ]);
    expect(withDefaultLeadRoute(config.leadRoutes, null)).toEqual([
      "factory-droid/claude-opus-5-5",
    ]);
  });

  it("replaces one role's launch fields and drops cleared ones", () => {
    expect(
      withRoleLaunchDefaults(config.roleDefaults, "supervisor", { thinkingOptionId: null }),
    ).toEqual({
      supervisor: { route: "claude/claude-fable-5-1" },
      lead: { thinkingOptionId: "max" },
    });
    expect(withRoleLaunchDefaults(undefined, "lead", { thinkingOptionId: "low" })).toEqual({
      lead: { thinkingOptionId: "low" },
    });
  });

  it("keeps the Supervisor permission across other edits and clears it on null", () => {
    const withBypass = withRoleLaunchDefaults(config.roleDefaults, "supervisor", {
      permission: "bypass",
    });
    expect(withBypass.supervisor).toEqual({
      route: "claude/claude-fable-5-1",
      thinkingOptionId: "high",
      permission: "bypass",
    });
    expect(
      withRoleLaunchDefaults(withBypass, "supervisor", { thinkingOptionId: "low" }).supervisor
        ?.permission,
    ).toBe("bypass");
    expect(
      withRoleLaunchDefaults(withBypass, "supervisor", { permission: null }).supervisor,
    ).toEqual({ route: "claude/claude-fable-5-1", thinkingOptionId: "high" });
  });

  it("starts a draft with the Human authority when the role offers it", () => {
    const authorityConfig = {
      roleDefaults: {
        supervisor: { assignmentEffect: "delegation" as const },
        lead: { assignmentEffect: "bootstrap" as const },
      },
    };
    expect(resolveDefaultAssignmentEffect(authorityConfig, "supervisor")).toBe("delegation");
    expect(resolveDefaultAssignmentEffect(authorityConfig, "lead")).toBe("mutating");
    expect(resolveDefaultAssignmentEffect(null, "supervisor")).toBe("read-only");
    expect(
      withRoleLaunchDefaults(authorityConfig.roleDefaults, "supervisor", {
        assignmentEffect: "read-only",
      }).supervisor,
    ).toEqual({ assignmentEffect: "read-only" });
  });
});
