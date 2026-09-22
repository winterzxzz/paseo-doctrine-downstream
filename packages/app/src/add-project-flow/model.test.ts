import { describe, expect, it } from "vitest";
import {
  backAddProjectPage,
  chooseAddProjectHost,
  currentAddProjectPage,
  moveAddProjectActiveIndex,
  moveAddProjectSelection,
  openAddProjectFlow,
  openDirectoryBrowsePage,
  openDirectorySearchPage,
  openGithubLocationPage,
  openNewDirectoryNamePage,
  openNewDirectoryParentPage,
  setAddProjectActiveIndex,
  setAddProjectPageInput,
  setNewDirectoryName,
  type AddProjectHost,
} from "./model";
import {
  addProjectMethodEmptyText,
  buildAddProjectMethods,
  buildCloneLocationOptions,
  buildDirectoryBrowseEntries,
  buildManualGithubRepositoryChoices,
  filterDirectoryBrowseEntries,
} from "./options";

const HOST: AddProjectHost = {
  serverId: "host-1",
  label: "Local",
  canAddProject: true,
  canBrowse: true,
  canPickHostDirectory: false,
  canCloneGithubRepositories: true,
  canSearchGithubRepositories: true,
  canCreateDirectory: true,
};

describe("Add Project navigation", () => {
  it("skips a single connected host without adding it to history", () => {
    const state = openAddProjectFlow({ hosts: [HOST] });

    expect(currentAddProjectPage(state)).toEqual({
      kind: "method",
      hostId: "host-1",
      activeIndex: 0,
      error: null,
      isSubmitting: false,
    });
    expect(backAddProjectPage(state)).toBeNull();
  });

  it("restores page input and selection after Back", () => {
    const secondHost = { ...HOST, serverId: "host-2", label: "Remote" };
    let state = openAddProjectFlow({ hosts: [HOST, secondHost] });
    state = setAddProjectPageInput(state, "rem");
    state = setAddProjectActiveIndex(state, 1);
    state = chooseAddProjectHost(state, secondHost.serverId);
    state = openDirectorySearchPage(state, secondHost.serverId);

    state = backAddProjectPage(state) ?? state;
    state = backAddProjectPage(state) ?? state;

    expect(currentAddProjectPage(state)).toEqual({
      kind: "host",
      query: "rem",
      activeIndex: 1,
      error: null,
    });
  });

  it("wraps keyboard selection in both directions", () => {
    expect(moveAddProjectActiveIndex(2, 3, "next")).toBe(0);
    expect(moveAddProjectActiveIndex(0, 3, "previous")).toBe(2);
    expect(moveAddProjectSelection(0, [true, false, true], "next")).toBe(2);
  });

  it("restores a directory name after returning to and reselecting its parent", () => {
    let state = openAddProjectFlow({ hosts: [HOST] });
    state = openNewDirectoryParentPage(state, HOST.serverId);
    state = openNewDirectoryNamePage(state, HOST.serverId, "~/dev");
    state = setNewDirectoryName(state, "command-center");
    state = backAddProjectPage(state) ?? state;
    state = openNewDirectoryNamePage(state, HOST.serverId, "~/dev");

    expect(currentAddProjectPage(state)).toMatchObject({
      kind: "new-directory-name",
      parentPath: "~/dev",
      name: "command-center",
    });
  });

  it("restores the GitHub destination query and active parent when reopening a repository", () => {
    const repository = {
      id: "repo-1",
      nameWithOwner: "getpaseo/paseo",
      cloneUrl: "git@github.com:getpaseo/paseo.git",
      description: null,
      visibility: "public",
      updatedAt: null,
    };
    let state = openAddProjectFlow({ hosts: [HOST] });
    state = openGithubLocationPage(state, HOST.serverId, repository);
    state = setAddProjectPageInput(state, "~/dev");
    state = setAddProjectActiveIndex(state, 2);
    state = backAddProjectPage(state) ?? state;
    state = openGithubLocationPage(state, HOST.serverId, repository);

    expect(currentAddProjectPage(state)).toMatchObject({
      kind: "github-location",
      query: "~/dev",
      activeIndex: 2,
    });
  });
});

describe("Add Project browsing", () => {
  it("descends into a folder as a new page so Back climbs one level", () => {
    let state = openAddProjectFlow({ hosts: [HOST] });
    state = openDirectoryBrowsePage(state, HOST.serverId, "~");
    state = openDirectoryBrowsePage(state, HOST.serverId, "~/dev");

    expect(currentAddProjectPage(state)).toMatchObject({
      kind: "directory-browse",
      directoryPath: "~/dev",
      query: "",
    });

    state = backAddProjectPage(state) ?? state;
    expect(currentAddProjectPage(state)).toMatchObject({
      kind: "directory-browse",
      directoryPath: "~",
    });
  });

  it("keeps a filter typed in one folder out of the folder above it", () => {
    let state = openAddProjectFlow({ hosts: [HOST] });
    state = openDirectoryBrowsePage(state, HOST.serverId, "~");
    state = setAddProjectPageInput(state, "dev");
    state = openDirectoryBrowsePage(state, HOST.serverId, "~/dev");

    expect(currentAddProjectPage(state)).toMatchObject({ query: "" });
    expect(backAddProjectPage(state)).toMatchObject({
      pages: [expect.anything(), expect.objectContaining({ query: "dev" })],
    });
  });

  it("resolves host-relative entries against the browsed directory", () => {
    expect(
      buildDirectoryBrowseEntries({
        directoryPath: "~/dev",
        relativePaths: ["paseo", "./tools", "nested/project", "paseo", "", "."],
      }),
    ).toEqual([
      { path: "~/dev/paseo", label: "paseo" },
      { path: "~/dev/tools", label: "tools" },
      { path: "~/dev/nested/project", label: "nested/project" },
    ]);
  });

  it("narrows the listed folder by name without asking the host again", () => {
    const entries = buildDirectoryBrowseEntries({
      directoryPath: "~/dev",
      relativePaths: ["paseo", "Paseo-Fork", "tools"],
    });

    expect(filterDirectoryBrowseEntries(entries, "  PASEO ")).toEqual([
      { path: "~/dev/paseo", label: "paseo" },
      { path: "~/dev/Paseo-Fork", label: "Paseo-Fork" },
    ]);
    expect(filterDirectoryBrowseEntries(entries, "   ")).toEqual(entries);
    expect(filterDirectoryBrowseEntries(entries, "missing")).toEqual([]);
  });

  it("joins entries under the filesystem root without doubling the separator", () => {
    expect(buildDirectoryBrowseEntries({ directoryPath: "/", relativePaths: ["Volumes"] })).toEqual(
      [{ path: "/Volumes", label: "Volumes" }],
    );
  });
});

describe("Add Project options", () => {
  it("hides every mutating method when the host lacks stable project identity", () => {
    const outdatedHost = { ...HOST, canAddProject: false };

    expect(buildAddProjectMethods(outdatedHost)).toEqual([]);
    expect(addProjectMethodEmptyText(outdatedHost)).toBe("Update the host to use Add Project.");
  });

  it("keeps host-upgrade methods discoverable and Browse available without Finder", () => {
    expect(
      buildAddProjectMethods({
        ...HOST,
        canBrowse: false,
        canCloneGithubRepositories: false,
        canSearchGithubRepositories: false,
        canCreateDirectory: false,
      }),
    ).toEqual([
      {
        id: "browse-folders",
        label: "Browse folders",
        description: "Step through the folders on Local",
      },
      {
        id: "directory-search",
        label: "Search for directory",
        description: "Find a directory on Local",
      },
      {
        id: "github",
        label: "Clone from GitHub",
        description: "Update this host to clone GitHub repositories",
        disabled: true,
      },
      {
        id: "new-directory",
        label: "New directory",
        description: "Update this host to create directories",
        disabled: true,
      },
    ]);
  });

  it("offers the host's own chooser only where a window can reach someone", () => {
    const withoutScreen = { ...HOST, canBrowse: false, canPickHostDirectory: false };
    const viaDaemon = { ...HOST, canBrowse: false, canPickHostDirectory: true };
    const viaFinder = { ...HOST, canBrowse: true, canPickHostDirectory: false };

    expect(buildAddProjectMethods(withoutScreen).map((method) => method.id)).not.toContain(
      "browse",
    );
    expect(buildAddProjectMethods(viaDaemon)[0]).toEqual({
      id: "browse",
      label: "Browse",
      description: "Choose a folder in a window on Local",
    });
    expect(buildAddProjectMethods(viaFinder)[0]).toEqual({
      id: "browse",
      label: "Browse",
      description: "Choose or create a directory in Finder",
    });
    expect(buildAddProjectMethods(withoutScreen)[0]?.id).toBe("browse-folders");
  });

  it("offers manual URL and protocol-specific owner/repo clone choices", () => {
    expect(buildManualGithubRepositoryChoices("git@github.com:getpaseo/paseo.git")).toEqual([
      expect.objectContaining({
        id: "manual:git@github.com:getpaseo/paseo.git",
        nameWithOwner: "getpaseo/paseo",
        cloneUrl: "git@github.com:getpaseo/paseo.git",
      }),
    ]);
    expect(buildManualGithubRepositoryChoices("getpaseo/paseo")).toEqual([
      expect.objectContaining({ cloneProtocol: "https", cloneUrl: "getpaseo/paseo" }),
      expect.objectContaining({ cloneProtocol: "ssh", cloneUrl: "getpaseo/paseo" }),
    ]);
    expect(buildManualGithubRepositoryChoices("paseo")).toEqual([]);
  });

  it("shows final clone paths while retaining parent paths as values", () => {
    expect(
      buildCloneLocationOptions({
        parents: ["~/dev", "~/workspace"],
        repositoryName: "paseo",
        existingPaths: ["~/workspace/paseo"],
      }),
    ).toEqual([
      {
        id: "~/dev",
        path: "~/dev",
        displayPath: "~/dev/paseo",
        secondaryText: "Parent directory: ~/dev",
        disabled: false,
      },
      {
        id: "~/workspace",
        path: "~/workspace",
        displayPath: "~/workspace/paseo",
        secondaryText: "Already exists",
        disabled: true,
      },
    ]);
  });

  it("shows equivalent absolute-home and tilde destinations only once", () => {
    expect(
      buildCloneLocationOptions({
        parents: ["/Users/moboudra/dev", "~/dev"],
        repositoryName: "dotfiles",
        existingPaths: [],
      }),
    ).toEqual([
      {
        id: "/Users/moboudra/dev",
        path: "/Users/moboudra/dev",
        displayPath: "/Users/moboudra/dev/dotfiles",
        secondaryText: "Parent directory: /Users/moboudra/dev",
        disabled: false,
      },
    ]);
  });
});
