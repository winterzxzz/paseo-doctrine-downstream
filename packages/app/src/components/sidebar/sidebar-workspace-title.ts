import type { SidebarWorkspaceEntry } from "@/hooks/use-sidebar-workspaces-list";
import type { WorkspaceTitleSource } from "@/hooks/use-settings";
import { STATUS_BUCKET_LABELS } from "@/hooks/sidebar-status-view-model";

type SidebarWorkspaceLabelSource = Pick<SidebarWorkspaceEntry, "name" | "currentBranch"> &
  Partial<Pick<SidebarWorkspaceEntry, "rootRoleId">>;

// Lead and Peer threads carry their role in the title their creator writes; a Supervisor
// thread is started by the Human, so the sidebar adds the matching prefix itself.
const SUPERVISOR_TITLE_PREFIX = "Sup: ";
const SUPERVISOR_TITLE_PREFIX_PATTERN = /^sup(ervisor)?\s*:/i;

export function resolveSidebarWorkspacePrimaryLabel(input: {
  workspace: SidebarWorkspaceLabelSource;
  workspaceTitleSource: WorkspaceTitleSource;
}): string {
  if (input.workspaceTitleSource === "branch") {
    return input.workspace.currentBranch ?? input.workspace.name;
  }
  if (
    input.workspace.rootRoleId === "supervisor" &&
    !SUPERVISOR_TITLE_PREFIX_PATTERN.test(input.workspace.name)
  ) {
    return `${SUPERVISOR_TITLE_PREFIX}${input.workspace.name}`;
  }
  return input.workspace.name;
}

export function resolveSidebarWorkspaceAccessibilityLabel(input: {
  workspace: SidebarWorkspaceLabelSource & Pick<SidebarWorkspaceEntry, "statusBucket">;
  workspaceTitleSource: WorkspaceTitleSource;
  leadingProjectName?: string | null;
  hostBadgeLabel?: string | null;
  pullRequestLabel?: string | null;
  serviceLabel?: string | null;
}): string {
  return [
    input.leadingProjectName,
    resolveSidebarWorkspacePrimaryLabel(input),
    input.hostBadgeLabel,
    input.pullRequestLabel,
    input.serviceLabel,
    input.workspace.statusBucket === "done"
      ? null
      : STATUS_BUCKET_LABELS[input.workspace.statusBucket],
  ]
    .filter((label): label is string => Boolean(label))
    .join(", ");
}
