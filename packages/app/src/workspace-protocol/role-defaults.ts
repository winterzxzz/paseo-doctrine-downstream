import type { MutableDaemonConfig, RoleDefaults } from "@getpaseo/protocol/messages";
import type { PaseoRoleId } from "@getpaseo/protocol/role-binding";

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
  launch: { route?: string | null; thinkingOptionId?: string | null },
): RoleDefaults {
  const current = roleDefaults?.[roleId] ?? {};
  const route = launch.route === undefined ? current.route : (launch.route ?? undefined);
  const thinkingOptionId =
    launch.thinkingOptionId === undefined
      ? current.thinkingOptionId
      : (launch.thinkingOptionId ?? undefined);
  return {
    ...roleDefaults,
    [roleId]: {
      ...(route ? { route } : {}),
      ...(thinkingOptionId ? { thinkingOptionId } : {}),
    },
  };
}
