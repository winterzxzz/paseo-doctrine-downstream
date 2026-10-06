// Exact Factory Droid ACP launch shapes. Pure so role admission and client routing share it.

const DROID_EXECUTABLES = new Set(["droid", "droid.exe"]);
const NPX_EXECUTABLES = new Set(["npx", "npx.cmd"]);
const DROID_PACKAGE_PATTERN = /^droid(@[0-9A-Za-z.+-]+)?$/u;

// Flags that would give the route a second source of instructions, autonomy, MCP config or
// workspace — the role capsule owns all of those.
const CALLER_POLICY_FLAGS = new Set([
  "--auto",
  "--skip-permissions-unsafe",
  "--append-system-prompt",
  "--append-system-prompt-file",
  "--settings",
  "--cwd",
  "-w",
  "--worktree",
  "--worktree-dir",
  "--mission",
  "--use-spec",
  "-s",
  "--session-id",
  "--fork",
  "-f",
  "--file",
]);

function basename(value: string): string {
  return value.split(/[\\/]/u).at(-1) ?? value;
}

/** Arguments after the Droid program itself, or null when this is not a Droid launch. */
function droidArguments(command: readonly string[] | undefined): string[] | null {
  if (!command || command.length === 0) return null;
  const executable = basename(command[0]);
  if (DROID_EXECUTABLES.has(executable)) return command.slice(1);
  if (!NPX_EXECUTABLES.has(executable)) return null;
  let index = 1;
  while (command[index] === "-y" || command[index] === "--yes") index += 1;
  return command[index] && DROID_PACKAGE_PATTERN.test(command[index])
    ? command.slice(index + 1)
    : null;
}

export function isDroidLaunchCommand(command: readonly string[] | undefined): boolean {
  return droidArguments(command) !== null;
}

export type DroidACPRoleCommandCheck = { ok: true } | { ok: false; reason: string };

export function checkDroidACPRoleCommand(
  command: readonly string[] | undefined,
): DroidACPRoleCommandCheck {
  const args = droidArguments(command);
  const reason =
    "Factory Droid native role binding requires exact 'droid exec --output-format acp-daemon' " +
    "(directly or through 'npx -y droid@<version>') without caller-supplied autonomy, " +
    "system-prompt, settings, workspace or session flags";
  if (!args || args[0] !== "exec") return { ok: false, reason };
  const rest = args.slice(1);
  const formatIndex = rest.findIndex(
    (argument) => argument === "--output-format" || argument === "-o",
  );
  const hasAcpFormat =
    (formatIndex >= 0 && rest[formatIndex + 1] === "acp-daemon") ||
    rest.includes("--output-format=acp-daemon");
  const hasCallerPolicy = rest.some((argument) =>
    CALLER_POLICY_FLAGS.has(argument.split("=")[0] ?? argument),
  );
  return hasAcpFormat && !hasCallerPolicy ? { ok: true } : { ok: false, reason };
}
