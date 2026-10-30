import type { MutableDaemonConfig, RoleDefaults } from "@getpaseo/protocol/messages";
import type { PaseoRoleId } from "@getpaseo/protocol/role-binding";
import type { AssignmentEffectClass } from "@getpaseo/protocol/assignment-contract";
import {
  defaultAssignmentEffectForRole,
  ordinaryAssignmentAuthorityOptionsForRole,
} from "@/workspace-protocol/assignment-authority";

export interface RoleDraftDefaults {
  provider: string;
  model: string;
  thinkingOptionId?: string;
}

function splitRoute(route: string | undefined): { provider: string; model: string } | null {
  const slash = route?.indexOf("/") ?? -1;
  if (!route || slash <= 0 || slash === route.length - 1) return null;
  return { provider: route.slice(0, slash), model: route.slice(slash + 1) };
}

/** The Human default route for a role: Lead uses the first Lead route, Supervisor its own. */
export function resolveRoleDefaultRoute(
  config: Pick<MutableDaemonConfig, "leadRoutes" | "roleDefaults"> | null | undefined,
  roleId: PaseoRoleId,
): string | undefined {
  if (roleId === "lead") return config?.leadRoutes?.[0];
  if (roleId === "supervisor") return config?.roleDefaults?.supervisor?.route;
  return undefined;
}

/** Model and effort a new draft takes when the Human picks Supervisor or Lead. */
export function resolveRoleDraftDefaults(
  config: Pick<MutableDaemonConfig, "leadRoutes" | "roleDefaults"> | null | undefined,
  roleId: PaseoRoleId | null,
): RoleDraftDefaults | null {
  if (roleId !== "lead" && roleId !== "supervisor") return null;
  const route = splitRoute(resolveRoleDefaultRoute(config, roleId));
  if (!route) return null;
  const thinkingOptionId = config?.roleDefaults?.[roleId]?.thinkingOptionId;
  return { ...route, ...(thinkingOptionId ? { thinkingOptionId } : {}) };
}

/** Makes `route` the default Lead route and keeps the other routes as ordered fallbacks. */
export function withDefaultLeadRoute(
  routes: readonly string[] | undefined,
  route: string | null,
): string[] {
  const rest = (routes ?? []).slice(1).filter((candidate) => candidate !== route);
  return route ? [route, ...rest] : rest;
}

/** Returns role defaults with one role's launch fields replaced; empty fields are dropped. */
export function withRoleLaunchDefaults(
  roleDefaults: RoleDefaults | undefined,
  roleId: "supervisor" | "lead",
  launch: {
    route?: string | null;
    thinkingOptionId?: string | null;
    assignmentEffect?: AssignmentEffectClass | null;
    /** Supervisor only: runtime permission instead of the per-authority policy. */
    permission?: SupervisorPermission | null;
  },
): RoleDefaults {
  const current = roleDefaults?.[roleId] ?? {};
  const pick = <T>(next: T | null | undefined, previous: T | undefined): T | undefined =>
    next === undefined ? previous : (next ?? undefined);
  const route = pick(launch.route, current.route);
  const thinkingOptionId = pick(launch.thinkingOptionId, current.thinkingOptionId);
  const assignmentEffect = pick(launch.assignmentEffect, current.assignmentEffect);
  const permission =
    roleId === "supervisor" ? pick(launch.permission, current.permission) : undefined;
  return {
    ...roleDefaults,
    [roleId]: {
      ...(route ? { route } : {}),
      ...(thinkingOptionId ? { thinkingOptionId } : {}),
      ...(assignmentEffect ? { assignmentEffect } : {}),
      ...(permission ? { permission } : {}),
    },
  };
}

/** How a new Supervisor's runtime asks for permission: "ask", "bypass", or unset (by authority). */
export type SupervisorPermission = NonNullable<
  NonNullable<RoleDefaults["supervisor"]>["permission"]
>;

/** The assignment authority a new draft starts with for a role: the Human default, if allowed. */
export function resolveDefaultAssignmentEffect(
  config: Pick<MutableDaemonConfig, "roleDefaults"> | null | undefined,
  roleId: PaseoRoleId,
): AssignmentEffectClass {
  const preferred =
    roleId === "supervisor" || roleId === "lead"
      ? config?.roleDefaults?.[roleId]?.assignmentEffect
      : undefined;
  return preferred &&
    ordinaryAssignmentAuthorityOptionsForRole(roleId).some((option) => option.id === preferred)
    ? preferred
    : defaultAssignmentEffectForRole(roleId);
}
