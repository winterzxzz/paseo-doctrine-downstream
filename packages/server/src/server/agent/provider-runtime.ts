import type { Logger } from "pino";
import { isPaseoSupportedProvider } from "@getpaseo/protocol/provider-config";

import {
  ProviderSnapshotManager,
  type ProviderSnapshotManagerOptions,
} from "./provider-snapshot-manager.js";
import { OpenCodeBridge } from "./providers/opencode/bridge.js";
import type { PaseoToolCatalog } from "./tools/types.js";

export interface AgentProviderRuntime {
  snapshotManager: ProviderSnapshotManager;
  setPaseoToolCatalog(catalog: Pick<PaseoToolCatalog, "tools"> | null): void;
  shutdown(): Promise<void>;
}

interface CreateAgentProviderRuntimeOptions {
  paseoHome: string;
  logger: Logger;
  snapshotManager: Omit<ProviderSnapshotManagerOptions, "logger" | "openCodeBridge">;
}

export async function createAgentProviderRuntime(
  options: CreateAgentProviderRuntimeOptions,
): Promise<AgentProviderRuntime> {
  const openCodeOverride = options.snapshotManager.providerOverrides?.opencode;
  const configuredPort =
    options.snapshotManager.runtimeSettings?.opencode?.env?.PASEO_OPENCODE_BRIDGE_PORT;
  const port = configuredPort === undefined ? undefined : Number(configuredPort);
  if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535))
    throw new Error("PASEO_OPENCODE_BRIDGE_PORT must be an integer between 1 and 65535");
  const bridge =
    openCodeOverride?.enabled === true && isPaseoSupportedProvider("opencode", openCodeOverride)
      ? new OpenCodeBridge({ paseoHome: options.paseoHome, logger: options.logger, port })
      : null;
  try {
    await bridge?.start();
    const snapshotManager = new ProviderSnapshotManager({
      ...options.snapshotManager,
      logger: options.logger.child({ module: "provider-snapshot-manager" }),
      ...(bridge ? { openCodeBridge: bridge } : {}),
    });
    let shutdownPromise: Promise<void> | null = null;
    return {
      snapshotManager,
      setPaseoToolCatalog: (catalog) => bridge?.setManifestCatalog(catalog),
      shutdown: () => {
        shutdownPromise ??= shutdownProviderRuntime(snapshotManager, bridge);
        return shutdownPromise;
      },
    };
  } catch (error) {
    await bridge?.close().catch(() => undefined);
    throw error;
  }
}

async function shutdownProviderRuntime(
  snapshotManager: ProviderSnapshotManager,
  bridge: OpenCodeBridge | null,
): Promise<void> {
  try {
    await snapshotManager.shutdown();
  } finally {
    await bridge?.close();
  }
}
