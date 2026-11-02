import type pino from "pino";
import type { PluginManifest } from "./manifest.js";
import { runCompilerTask } from "./compiler.js";
import type { PluginBuildOptions } from "./preparation-build.js";

export { PLUGIN_BUILD_TIMEOUT_MS } from "./preparation-build.js";

export async function runPluginBuild(
  directory: string,
  commands: PluginManifest["build"],
  logger: pino.Logger,
  options: PluginBuildOptions = {},
): Promise<void> {
  if (!commands?.length) return;
  await runCompilerTask(
    { kind: "prepare", directory, commands, environment: { ...process.env }, options },
    (data, message) => logger.info(data, message),
  );
}
