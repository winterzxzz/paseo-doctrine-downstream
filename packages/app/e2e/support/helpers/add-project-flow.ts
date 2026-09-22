import { expect, type Locator, type Page } from "@playwright/test";

export type AddProjectFlowPage =
  | "host"
  | "method"
  | "directory-search"
  | "directory-browse"
  | "github-search"
  | "github-location"
  | "new-directory-parent"
  | "new-directory-name";

export type AddProjectMethod = "directory-search" | "browse" | "github" | "new-directory";

// Browse opens the host-backed folder browser everywhere except the desktop app, where the
// Electron runtime hands the choice to Finder instead of pushing a page.
const METHOD_DESTINATIONS: Record<AddProjectMethod, AddProjectFlowPage> = {
  browse: "directory-browse",
  "directory-search": "directory-search",
  github: "github-search",
  "new-directory": "new-directory-parent",
};

export function addProjectFlow(page: Page): Locator {
  return page.getByTestId("add-project-flow");
}

export function addProjectFlowInput(page: Page): Locator {
  return page.getByTestId("add-project-flow-input");
}

export function addProjectFlowBack(page: Page): Locator {
  return page.getByTestId("add-project-flow-back");
}

export function addProjectFlowHost(page: Page, serverId: string): Locator {
  return page.getByTestId(`add-project-flow-host-${serverId}`);
}

export function addProjectFlowMethod(page: Page, method: AddProjectMethod): Locator {
  return page.getByTestId(`add-project-flow-method-${method}`);
}

export async function expectAddProjectPage(page: Page, kind: AddProjectFlowPage): Promise<Locator> {
  const currentPage = page.getByTestId(`add-project-flow-page-${kind}`);
  await expect(currentPage).toBeVisible({ timeout: 30_000 });
  return currentPage;
}

async function openAddProjectFlowSurface(
  page: Page,
  expectedPage: "host" | "method",
): Promise<void> {
  await page.getByTestId("sidebar-add-project").click();
  await expect(addProjectFlow(page)).toBeVisible({ timeout: 30_000 });
  await expectAddProjectPage(page, expectedPage);
}

export async function openAddProjectFlow(page: Page): Promise<void> {
  await openAddProjectFlowSurface(page, "method");
}

export async function openAddProjectHostSelection(page: Page): Promise<void> {
  await openAddProjectFlowSurface(page, "host");
  await expect(addProjectFlowInput(page)).toBeFocused();
}

export async function chooseAddProjectMethod(
  page: Page,
  method: AddProjectMethod,
  options: { expectPage?: boolean } = {},
): Promise<void> {
  const option = addProjectFlowMethod(page, method);
  await expect(option).toBeVisible();
  await option.click();
  if (options.expectPage !== false) {
    await expectAddProjectPage(page, METHOD_DESTINATIONS[method]);
  }
}

export function addProjectFlowBrowseEntry(page: Page, pathname: string): Locator {
  return page.getByTestId(`add-project-flow-path-${encodeURIComponent(pathname)}`);
}

export function addProjectFlowBrowseOpen(page: Page, pathname: string): Locator {
  return page.getByTestId(`add-project-flow-browse-open-${encodeURIComponent(pathname)}`);
}

export function addProjectFlowBrowseAdd(page: Page): Locator {
  return page.getByTestId("add-project-flow-browse-add");
}

export function addProjectFlowBrowseParent(page: Page): Locator {
  return page.getByTestId("add-project-flow-browse-parent");
}

export async function expectNewWorkspaceForAddedProject(
  page: Page,
  input: {
    serverId: string;
    projectId: string;
    projectName: string;
    projectPath: string;
  },
): Promise<void> {
  await expect(page).toHaveURL(/\/new\?.*projectId=/u, { timeout: 30_000 });
  const url = new URL(page.url());
  expect(url.pathname).toBe("/new");
  expect(url.searchParams.get("serverId")).toBe(input.serverId);
  expect(url.searchParams.get("projectId")).toBe(input.projectId);
  expect(url.searchParams.get("dir")).toBe(input.projectPath);
  await expect(page.getByRole("button", { name: "Workspace project" })).toContainText(
    input.projectName,
    { timeout: 30_000 },
  );
}
