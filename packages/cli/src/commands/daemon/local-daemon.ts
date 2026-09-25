import { Command, Option } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import path from "node:path";
import { startDaemonInstance, resolvePaseoHome } from "@getpaseo/server/daemon-control";

// Allow the lifecycle RPC handshake plus the supervisor's 25-second graceful
// worker cleanup window to complete before the CLI reports a false timeout.
export const DEFAULT_STOP_TIMEOUT_MS = 35_000;
export const DEFAULT_KILL_TIMEOUT_MS = 3_000;

const require = createRequire(import.meta.url);

const POSIX_USER_EXECUTABLE_DIRS = [
  ["bin"],
  [".local", "bin"],
  [".opencode", "bin"],
  [".bun", "bin"],
] as const;

function appendUserExecutableDirs(env: NodeJS.ProcessEnv): void {
  if (process.platform === "win32") return;

  const home = env.HOME?.trim() || homedir();
  const existingEntries = env.PATH ? env.PATH.split(path.delimiter) : [];
  const seen = new Set(existingEntries.filter(Boolean));

  for (const segments of POSIX_USER_EXECUTABLE_DIRS) {
    const candidate = path.join(home, ...segments);
    if (seen.has(candidate)) continue;
    existingEntries.push(candidate);
    seen.add(candidate);
  }

  env.PATH = existingEntries.join(path.delimiter);
}

function buildLaunchEnv(overrides: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...overrides };
  // Background and service launches do not load shell startup files. Keep the inherited PATH
  // precedence, then add common user-level install locations for agent CLIs.
  appendUserExecutableDirs(env);
  return env;
}

function resolveServerRunnerFromDir(currentDir: string): string | null {
  const packageJsonPath = path.join(currentDir, "package.json");
  if (!existsSync(packageJsonPath)) return null;
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { name?: string };
    if (packageJson.name !== "@getpaseo/server") return null;
    const distRunner = path.join(currentDir, "dist", "scripts", "supervisor-entrypoint.js");
    if (existsSync(distRunner)) {
      return distRunner;
    }
    return path.join(currentDir, "scripts", "supervisor-entrypoint.ts");
  } catch {
    return null;
  }
}

function resolveDaemonRunnerEntry(): string {
  const serverExportPath = require.resolve("@getpaseo/server");
  let currentDir = path.dirname(serverExportPath);

  while (true) {
    const entry = resolveServerRunnerFromDir(currentDir);
    if (entry) {
      return entry;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  throw new Error("Unable to resolve @getpaseo/server package root for daemon runner");
}

export async function launchLocalDaemon(options: {
  home: string;
  timeoutMs?: number;
  foreground?: boolean;
  /** Deployment environment overrides; honored only by a foreground launch. */
  env?: NodeJS.ProcessEnv;
}) {
  const abort = new AbortController();
  const cancel = () => abort.abort();
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  try {
    const entry = resolveDaemonRunnerEntry();
    return await startDaemonInstance({
      home: resolvePaseoHome({ PASEO_HOME: options.home }),
      command: process.execPath,
      args: [...(entry.endsWith(".ts") ? ["--import", "tsx"] : []), entry],
      env: buildLaunchEnv(options.env),
      mode: options.foreground ? "deployment" : "managed",
      foreground: options.foreground,
      timeoutMs: options.timeoutMs,
      signal: abort.signal,
      onReady: options.foreground
        ? (instance) =>
            process.stdout.write(`Listening on ${instance.listen} (PID ${instance.pid})\n`)
        : undefined,
    });
  } finally {
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
  }
}

export function parseTimeoutMs(raw: unknown, fallback = 600_000): number {
  if (raw === undefined) return fallback;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0)
    throw { code: "INVALID_TIMEOUT", message: "Timeout must be a positive number of seconds." };
  return Math.ceil(seconds * 1000);
}

const REMOVED_LAUNCH_FLAGS: Record<string, string> = {
  "--port <port>": "daemon.listen",
  "--listen <listen>": "daemon.listen",
  "--relay": "daemon.relay.enabled",
  "--no-relay": "daemon.relay.enabled",
  "--relay-use-tls": "daemon.relay.useTls",
  "--no-mcp": "daemon.mcp.enabled",
  "--no-inject-mcp": "daemon.mcp.injectIntoAgents",
  "--web-ui": "features.webUi.enabled",
  "--no-web-ui": "features.webUi.enabled",
  "--hostnames <hosts>": "daemon.hostnames",
  "--allowed-hosts <hosts>": "daemon.hostnames",
  "--foreground": "",
};

// COMPAT(legacyForegroundLaunchFlags): added in v0.9.2-paseo.60, remove after the web-cli installer launches with paseo daemon run
// The downstream web-cli service units (launchd, systemd, Windows) and artifact smokes launch
// `paseo daemon start --foreground --listen <host:port> --web-ui --no-relay`. With --foreground,
// `daemon start` accepts exactly these flags and runs the `daemon run` foreground path with the
// equivalent deployment environment overrides. Every other removed flag, and every removed flag
// without --foreground, still fails with REMOVED_LAUNCH_OPTION.
const LEGACY_FOREGROUND_LAUNCH_FLAGS = new Set([
  "--foreground",
  "--listen <listen>",
  "--port <port>",
  "--web-ui",
  "--no-web-ui",
  "--relay",
  "--no-relay",
]);

// COMPAT(legacyForegroundLaunchFlags): added in v0.9.2-paseo.60, remove after the web-cli installer launches with paseo daemon run
export function isLegacyForegroundLaunch(command: Command): boolean {
  return command.getOptionValueSource("foreground") === "cli";
}

// COMPAT(legacyForegroundLaunchFlags): added in v0.9.2-paseo.60, remove after the web-cli installer launches with paseo daemon run
export function legacyForegroundLaunchEnv(command: Command): NodeJS.ProcessEnv {
  const options = command.opts<{
    listen?: string;
    port?: string;
    webUi?: boolean;
    relay?: boolean;
  }>();
  const given = (name: string) => command.getOptionValueSource(name) === "cli";
  const env: NodeJS.ProcessEnv = {};
  if (given("listen")) env.PASEO_LISTEN = options.listen;
  else if (given("port")) env.PASEO_LISTEN = `127.0.0.1:${options.port}`;
  if (given("webUi")) env.PASEO_WEB_UI_ENABLED = options.webUi ? "true" : "false";
  if (given("relay")) env.PASEO_RELAY_ENABLED = options.relay ? "true" : "false";
  return env;
}

export function rejectRemovedLaunchFlags(
  command: Command,
  options: { allowLegacyForegroundLaunch?: boolean } = {},
): Command {
  for (const flag of Object.keys(REMOVED_LAUNCH_FLAGS))
    command.addOption(new Option(flag).hideHelp());
  command.hook("preAction", () => {
    // COMPAT(legacyForegroundLaunchFlags): added in v0.9.2-paseo.60, remove after the web-cli installer launches with paseo daemon run
    const legacyForeground =
      options.allowLegacyForegroundLaunch === true && isLegacyForegroundLaunch(command);
    for (const [flag, configPath] of Object.entries(REMOVED_LAUNCH_FLAGS)) {
      if (legacyForeground && LEGACY_FOREGROUND_LAUNCH_FLAGS.has(flag)) continue;
      const name = new Option(flag).attributeName();
      if (command.getOptionValueSource(name) !== "cli") continue;
      throw {
        code: "REMOVED_LAUNCH_OPTION",
        message: `${flag.split(" ")[0]} was removed. ${configPath ? `Use paseo daemon config set ${configPath} <value> --home <path>, then start or restart.` : "Use paseo daemon run --home <path> for foreground deployment."} Deployment environment overrides belong to paseo daemon run.`,
      };
    }
  });
  return command;
}
