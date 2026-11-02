import { spawnProcess } from "../../utils/spawn.js";
import { terminateWithTreeKill } from "../../utils/tree-kill.js";

import type { PluginManifest } from "./manifest.js";

const OUTPUT_LIMIT = 64 * 1024;
export const PLUGIN_BUILD_TIMEOUT_MS = 5 * 60_000;
const PLUGIN_BUILD_GRACEFUL_TERMINATION_MS = 5_000;
const PLUGIN_BUILD_FORCE_TERMINATION_MS = 2_000;

// Plain numbers only: these options cross the compiler worker boundary.
export interface PluginBuildOptions {
  timeoutMs?: number;
  gracefulTerminationMs?: number;
  forceTerminationMs?: number;
}

export async function runPluginBuild(
  directory: string,
  commands: PluginManifest["build"],
  logger: { info(data: Record<string, unknown>, message: string): void },
  environment: NodeJS.ProcessEnv,
  options: PluginBuildOptions = {},
): Promise<void> {
  for (const command of commands ?? []) {
    logger.info({ directory, command }, "Running plugin build command");
    const result = await run(command, directory, environment, options);
    if (result.stdout)
      logger.info({ directory, command, output: result.stdout }, "Plugin build stdout");
    if (result.stderr)
      logger.info({ directory, command, output: result.stderr }, "Plugin build stderr");
    if (result.timedOut) {
      throw new Error(
        `Plugin build command timed out after ${options.timeoutMs ?? PLUGIN_BUILD_TIMEOUT_MS}ms: ${formatCommand(command)}${formatOutput(result)}`,
      );
    }
    if (result.error) {
      throw new Error(
        `Plugin build command failed to start: ${formatCommand(command)}\n${result.error.message}`,
      );
    }
    if (result.exitCode !== 0) {
      throw new Error(
        `Plugin build command failed (exit ${result.exitCode}): ${formatCommand(command)}${formatOutput(result)}`,
      );
    }
  }
}

async function run(
  command: string[],
  directory: string,
  environment: NodeJS.ProcessEnv,
  options: PluginBuildOptions,
): Promise<CommandResult> {
  const timeoutMs = options.timeoutMs ?? PLUGIN_BUILD_TIMEOUT_MS;
  let timedOut = false;
  let stdout = "";
  let stderr = "";
  let error: Error | undefined;

  const executable = command[0]!;
  const arguments_ = command.slice(1);
  const child = spawnProcess(executable, arguments_, {
    cwd: directory,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (chunk: Buffer | string) => {
    stdout = appendOutput(stdout, chunk.toString());
  });
  child.stderr?.on("data", (chunk: Buffer | string) => {
    stderr = appendOutput(stderr, chunk.toString());
  });
  child.once("error", (spawnError) => {
    error = spawnError;
  });

  const snapshot = (exitCode: number | null): CommandResult => ({
    exitCode,
    stdout,
    stderr,
    error,
    timedOut,
  });
  const closeResult = new Promise<CommandResult>((resolve) => {
    child.once("close", (exitCode) => resolve(snapshot(exitCode)));
  });
  let timeout: NodeJS.Timeout | undefined;
  const timeoutResult = new Promise<CommandResult>((resolve) => {
    timeout = setTimeout(() => {
      timedOut = true;
      void terminateWithTreeKill(child, {
        gracefulTimeoutMs: options.gracefulTerminationMs ?? PLUGIN_BUILD_GRACEFUL_TERMINATION_MS,
        forceTimeoutMs: options.forceTerminationMs ?? PLUGIN_BUILD_FORCE_TERMINATION_MS,
      })
        .catch((terminationError: unknown) => {
          error =
            terminationError instanceof Error
              ? terminationError
              : new Error(String(terminationError));
        })
        .finally(() => resolve(snapshot(child.exitCode)));
    }, timeoutMs);
  });

  const result = await Promise.race([closeResult, timeoutResult]);
  if (timeout) clearTimeout(timeout);
  return result;
}

function appendOutput(current: string, next: string): string {
  return `${current}${next}`.slice(-OUTPUT_LIMIT);
}

function formatCommand(command: string[]): string {
  return command.map((argument) => JSON.stringify(argument)).join(" ");
}

function formatOutput(result: CommandResult): string {
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  return output ? `\n${output}` : "";
}

interface CommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
  timedOut: boolean;
}
