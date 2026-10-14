import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

import { collectAllTabs, useWorkspaceLayoutStore } from "@/stores/workspace-layout-store";
import { openWorkspaceTargetBeside } from "@/workspace-tabs/open-beside";

const WORKSPACE_KEY = "server-1:workspace-supervisor";

beforeEach(() => {
  useWorkspaceLayoutStore.setState({
    layoutByWorkspace: {},
    explorerSidebarPaneIdByWorkspace: {},
    sidePaneIdByWorkspace: {},
    splitSizesByWorkspace: {},
    pinnedAgentIdsByWorkspace: {},
    hiddenAgentIdsByWorkspace: {},
  });
});

function agentTabIds(): string[] {
  const layout = useWorkspaceLayoutStore.getState().layoutByWorkspace[WORKSPACE_KEY];
  return layout
    ? collectAllTabs(layout.root).flatMap((tab) =>
        tab.target.kind === "agent" ? [tab.target.agentId] : [],
      )
    : [];
}

describe("openWorkspaceTargetBeside", () => {
  // A Supervisor's Lead runs in its own workspace, so it is never in this
  // workspace's active agent set. The topology click must still keep its tab.
  it("keeps an agent from another workspace open through tab reconciliation", () => {
    const tabId = openWorkspaceTargetBeside({
      workspaceKey: WORKSPACE_KEY,
      target: { kind: "agent", agentId: "lead-in-other-workspace" },
    });
    expect(tabId).not.toBeNull();

    useWorkspaceLayoutStore.getState().reconcileTabs(WORKSPACE_KEY, {
      agentsHydrated: true,
      terminalsHydrated: true,
      activeAgentIds: ["supervisor-1"],
      autoOpenAgentIds: [],
      knownTerminalIds: [],
      standaloneTerminalIds: [],
    });

    expect(agentTabIds()).toContain("lead-in-other-workspace");
  });
});
