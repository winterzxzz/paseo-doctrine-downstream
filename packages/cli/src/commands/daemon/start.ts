import { addLocalDaemonOptions } from "../../utils/command-options.js";
import { Command } from "commander";
import { daemonLogPath } from "@getpaseo/server/daemon-control";
import {
  isLegacyForegroundLaunch,
  launchLocalDaemon,
  legacyForegroundLaunchEnv,
  parseTimeoutMs,
  rejectRemovedLaunchFlags,
} from "./local-daemon.js";
import { withOutput, type CommandOptions, type SingleResult } from "../../output/index.js";

// Both launch paths share one result type so withOutput infers a single data shape.
type StartResult = SingleResult<Record<string, unknown>>;

export function startCommand(): Command {
  // COMPAT(legacyForegroundLaunchFlags): added in v0.9.2-paseo.60, remove after 2027-03-25 once the web-cli installer launches with paseo daemon run
  return rejectRemovedLaunchFlags(addLocalDaemonOptions(new Command("start")), {
    allowLegacyForegroundLaunch: true,
  })
    .description("Start the local daemon from persistent configuration (local operation)")
    .option("--timeout <seconds>", "Readiness deadline (default: 600)")
    .action(withOutput(runStart));
}

export async function runStart(options: CommandOptions, command: Command): Promise<StartResult> {
  if (options.daemonTarget.kind !== "instance") throw new Error("Start requires a local home");
  const home = options.daemonTarget.home;
  // COMPAT(legacyForegroundLaunchFlags): added in v0.9.2-paseo.60, remove after 2027-03-25 once the web-cli installer launches with paseo daemon run
  if (isLegacyForegroundLaunch(command)) {
    return runForegroundDaemon(home, legacyForegroundLaunchEnv(command));
  }
  const result = await launchLocalDaemon({ home, timeoutMs: parseTimeoutMs(options.timeout) });
  const data = {
    action: result.spawned ? "started" : "already_running",
    home,
    pid: result.instance.pid,
    listen: result.instance.listen,
    logPath: daemonLogPath(home),
  };
  return {
    type: "single" as const,
    data,
    schema: {
      idField: "pid" as const,
      columns: [],
      renderHuman: () =>
        `${result.spawned ? "Started" : "Already running"}: PID ${data.pid}${data.listen ? `, listening on ${data.listen}` : ", not ready"}\nLogs: ${data.logPath}`,
    },
  };
}

async function runForegroundDaemon(home: string, env?: NodeJS.ProcessEnv): Promise<StartResult> {
  const result = await launchLocalDaemon({ home, foreground: true, env });
  process.exitCode = result.exitCode ?? 0;
  return {
    type: "single" as const,
    data: { pid: result.instance.pid, action: result.spawned ? "exited" : "already_running" },
    schema: { idField: "pid" as const, columns: [] },
  };
}

export function daemonRunCommand(): Command {
  return rejectRemovedLaunchFlags(addLocalDaemonOptions(new Command("run")))
    .description("Run a local daemon in the foreground with deployment environment overrides")
    .action(
      withOutput(async (options: CommandOptions, _command: Command) => {
        if (options.daemonTarget.kind !== "instance") throw new Error("Run requires a local home");
        return runForegroundDaemon(options.daemonTarget.home);
      }),
    );
}
