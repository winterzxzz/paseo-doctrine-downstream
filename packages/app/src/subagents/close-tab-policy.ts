import type { Agent } from "@/stores/session-store";

// Closing an agent tab never archives. A subagent tab also holds this client's
// open-tab label, which the close has to release.
export type CloseAgentTabPolicy = { kind: "layout-only" } | { kind: "release-open-tab-label" };

export function resolveCloseAgentTabPolicy(
  agent: Pick<Agent, "parentAgentId"> | null | undefined,
): CloseAgentTabPolicy {
  if (agent?.parentAgentId) {
    return { kind: "release-open-tab-label" };
  }

  return { kind: "layout-only" };
}
