import {
  isCompleteGitRemote,
  parseGitHubRemoteUrl,
  parseGitRemoteLocation,
} from "@getpaseo/protocol/git-remote";
import { shortenPath } from "@/utils/shorten-path";
import type { AddProjectHost, GithubRepositoryChoice } from "./model";

export type AddProjectMethodId =
  | "directory-search"
  | "browse"
  | "browse-folders"
  | "github"
  | "new-directory";

export interface AddProjectMethodOption {
  id: AddProjectMethodId;
  label: string;
  description: string;
  disabled?: boolean;
}

export interface AddProjectPathOption {
  id: string;
  path: string;
  displayPath: string;
  secondaryText: string | null;
  disabled: boolean;
}

export function filterAddProjectHosts(hosts: AddProjectHost[], query: string): AddProjectHost[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return hosts;
  return hosts.filter(
    (host) =>
      host.label.toLowerCase().includes(normalized) ||
      host.serverId.toLowerCase().includes(normalized),
  );
}

export function buildAddProjectMethods(host: AddProjectHost): AddProjectMethodOption[] {
  if (!host.canAddProject) return [];
  const options: AddProjectMethodOption[] = [];
  // The host's own chooser is the first option whenever it can reach a screen: on the desktop app
  // Electron opens it, and a client sitting at the host's machine has the daemon open it there.
  if (host.canBrowse || host.canPickHostDirectory) {
    options.push({
      id: "browse",
      label: "Browse",
      description: host.canBrowse
        ? "Choose or create a directory in Finder"
        : `Choose a folder in a window on ${host.label}`,
    });
  }
  options.push({
    id: "browse-folders",
    label: "Browse folders",
    description: `Step through the folders on ${host.label}`,
  });
  options.push({
    id: "directory-search",
    label: "Search for directory",
    description: `Find a directory on ${host.label}`,
  });
  options.push({
    id: "github",
    label: "Clone from GitHub",
    description: githubMethodDescription(host),
    disabled: !host.canCloneGithubRepositories,
  });
  options.push({
    id: "new-directory",
    label: "New directory",
    description: host.canCreateDirectory
      ? `Create an empty directory on ${host.label}`
      : "Update this host to create directories",
    disabled: !host.canCreateDirectory,
  });
  return options;
}

export function addProjectMethodEmptyText(host: AddProjectHost | null): string {
  return host?.canAddProject === false
    ? "Update the host to use Add Project."
    : "No matching options";
}

function githubMethodDescription(host: AddProjectHost): string {
  if (!host.canCloneGithubRepositories) {
    return "Update this host to clone GitHub repositories";
  }
  if (host.canSearchGithubRepositories) {
    return "Search projects available to your GitHub account";
  }
  return "Enter a GitHub URL or owner/repo";
}

export function pathBaseName(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] ?? trimmed;
}

export function buildManualGithubRepositoryChoices(query: string): GithubRepositoryChoice[] {
  const repo = query.trim();
  if (!repo) return [];

  if (isCompleteGitRemote(repo)) {
    const identity = parseGitHubRemoteUrl(repo);
    const location = parseGitRemoteLocation(repo);
    const remoteName = location ? pathBaseName(location.path).replace(/\.git$/u, "") : repo;
    return [
      {
        id: `manual:${repo}`,
        nameWithOwner: identity?.repo ?? remoteName,
        cloneUrl: repo,
        description: "Clone this repository URL",
        updatedAt: null,
      },
    ];
  }

  const shorthand = repo.match(/^([^\s/]+)\/([^\s/]+)$/u);
  if (!shorthand) return [];
  const nameWithOwner = `${shorthand[1]}/${shorthand[2]}`;
  return (["https", "ssh"] as const).map((cloneProtocol) => ({
    id: `manual:${cloneProtocol}:${nameWithOwner}`,
    nameWithOwner,
    cloneUrl: nameWithOwner,
    cloneProtocol,
    description: `Clone owner/repo via ${cloneProtocol.toUpperCase()}`,
    updatedAt: null,
  }));
}

export const HOME_DIRECTORY = "~";
export const FILESYSTEM_ROOT = "/";

export interface DirectoryBrowseEntry {
  path: string;
  label: string;
}

// The host answers a browse request with the children of the directory being browsed, named
// relative to it.
export function buildDirectoryBrowseEntries(input: {
  directoryPath: string;
  relativePaths: string[];
}): DirectoryBrowseEntry[] {
  const seen = new Set<string>();
  return input.relativePaths.flatMap((relativePath) => {
    const label = relativePath.replace(/^[.]\//u, "").replace(/[\\/]+$/u, "");
    if (!label || label === ".") return [];
    const path = joinDirectoryPath(input.directoryPath, label);
    if (seen.has(path)) return [];
    seen.add(path);
    return [{ path, label }];
  });
}

export function filterDirectoryBrowseEntries(
  entries: DirectoryBrowseEntry[],
  query: string,
): DirectoryBrowseEntry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return entries;
  return entries.filter((entry) => entry.label.toLowerCase().includes(normalized));
}

export function parentDirectory(path: string): string | null {
  const trimmed = path.replace(/[\\/]+$/, "");
  const index = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  if (index < 0) return null;
  if (index === 0) return trimmed.slice(0, 1);
  return trimmed.slice(0, index);
}

export function joinDirectoryPath(parent: string, name: string): string {
  const trimmedParent = parent.replace(/[\\/]+$/, "");
  const separator = trimmedParent.includes("\\") && !trimmedParent.includes("/") ? "\\" : "/";
  return `${trimmedParent}${separator}${name}`;
}

export function buildSuggestedParentDirectories(projectPaths: string[]): string[] {
  const values = [
    ...projectPaths.flatMap((path) => {
      const parent = parentDirectory(path);
      return parent ? [parent] : [];
    }),
    "~/dev",
    "~/Developer",
    "~/src",
    "~/projects",
    "~/workspace",
    "~",
  ];
  return [...new Set(values)];
}

export function buildCloneLocationOptions(input: {
  parents: string[];
  repositoryName: string;
  existingPaths: string[];
}): AddProjectPathOption[] {
  const existing = new Set(input.existingPaths.map(pathIdentity));
  const seen = new Set<string>();
  return input.parents.flatMap((parent) => {
    const path = joinDirectoryPath(parent, input.repositoryName);
    const identity = pathIdentity(path);
    if (seen.has(identity)) return [];
    seen.add(identity);
    const pathExists = existing.has(identity);
    return [
      {
        id: parent,
        path: parent,
        displayPath: path,
        secondaryText: pathExists ? "Already exists" : `Parent directory: ${parent}`,
        disabled: pathExists,
      },
    ];
  });
}

function pathIdentity(path: string): string {
  const normalized = shortenPath(path.trim()).replace(/\\/g, "/").replace(/\/+$/u, "");
  return /^[A-Za-z]:\//u.test(normalized) || normalized.startsWith("//")
    ? normalized.toLowerCase()
    : normalized;
}
