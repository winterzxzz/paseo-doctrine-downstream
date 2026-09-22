import { execFile } from "node:child_process";

export interface HostDirectoryPick {
  path: string | null;
  cancelled: boolean;
}

interface PickHostDirectoryOptions {
  title?: string;
  platform?: NodeJS.Platform;
  run?: RunCommand;
  timeoutMs?: number;
}

type RunCommand = (
  command: string,
  args: string[],
  timeoutMs: number,
) => Promise<{ stdout: string; stderr: string; code: number }>;

// A dialog owns the screen until someone answers it, so the host runs at most one at a time and
// gives up on it eventually rather than leaving an orphan window in front of the user.
const DEFAULT_TIMEOUT_MS = 5 * 60_000;
// AppleScript reports a cancelled dialog as error -128 on a non-zero exit, which is an outcome,
// not a failure. The exit code alone does not say that much: a script error leaves the same 1.
const APPLESCRIPT_USER_CANCELLED = "-128";

let inFlight: Promise<HostDirectoryPick> | null = null;

export function isHostDirectoryPickerSupported(platform: NodeJS.Platform = process.platform) {
  return platform === "darwin";
}

export async function pickHostDirectory(
  options: PickHostDirectoryOptions = {},
): Promise<HostDirectoryPick> {
  const platform = options.platform ?? process.platform;
  if (!isHostDirectoryPickerSupported(platform)) {
    throw new Error("This host cannot open a folder chooser");
  }
  if (inFlight) {
    throw new Error("A folder chooser is already open on this host");
  }
  const pick = runPicker(options).finally(() => {
    inFlight = null;
  });
  inFlight = pick;
  return pick;
}

async function runPicker(options: PickHostDirectoryOptions): Promise<HostDirectoryPick> {
  const run = options.run ?? runCommand;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const prompt = (options.title ?? "Choose a folder for Paseo").replace(/["\\]/gu, "");
  const script = [
    'tell application "System Events" to activate',
    `set chosen to choose folder with prompt "${prompt}"`,
    "POSIX path of chosen",
  ].join("\n");
  const { stdout, stderr, code } = await run("osascript", ["-e", script], timeoutMs);
  if (code !== 0) {
    if (stderr.includes(APPLESCRIPT_USER_CANCELLED)) return { path: null, cancelled: true };
    throw new Error("The folder chooser could not be opened on this host");
  }
  const path = stdout.trim().replace(/\/+$/u, "");
  if (!path) return { path: null, cancelled: true };
  return { path, cancelled: false };
}

function runCommand(command: string, args: string[], timeoutMs: number) {
  return new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (!error) {
        resolve({ stdout, stderr, code: 0 });
        return;
      }
      if (typeof error.code !== "number") {
        reject(new Error("The folder chooser was closed before anyone answered it"));
        return;
      }
      resolve({ stdout, stderr, code: error.code });
    });
  });
}
