import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { RequestPermissionRequest } from "@agentclientprotocol/sdk";
import type { Logger } from "pino";

import type {
  AgentLaunchContext,
  AgentSessionConfig,
  McpServerConfig,
} from "../agent-sdk-types.js";
import { PASEO_MCP_SERVER_NAME } from "../runtime-mcp-config.js";
import type { ACPMcpToolIdentity, ACPSessionLaunchPreparation } from "./acp-agent.js";
import { checkDroidACPRoleCommand } from "./droid-acp-command.js";
import { GenericACPAgentClient } from "./generic-acp-agent.js";

interface DroidACPAgentClientOptions {
  logger: Logger;
  command: [string, ...string[]];
  env?: Record<string, string>;
  providerId?: string;
  label?: string;
  providerParams?: unknown;
  roleCapsuleRoot?: string;
  factoryHome?: string;
}

// Droid's ACP worker exits when session/new carries any MCP server, and it ignores every
// system-prompt flag in ACP mode. It does honour a whole private config home, so a role
// launch points FACTORY_HOME_OVERRIDE at a capsule whose `.factory/AGENTS.md` carries the
// exact binding and whose `.factory/mcp.json` carries the runtime MCP servers.
const DROID_HOME_ENV = "FACTORY_HOME_OVERRIDE";
const DROID_LOGIN_FILE = "auth.v2.loginkeychain";
const MCP_TOOL_NAME_PATTERN = /^[A-Za-z0-9_.-]+$/u;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function writeExclusiveOrVerify(path: string, content: string): Promise<void> {
  try {
    await writeFile(path, content, { encoding: "utf8", mode: 0o600, flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
    const existing = await readFile(path, "utf8");
    if (existing !== content) {
      throw new Error(`Droid role capsule collision at '${path}'`, { cause: error });
    }
  }
}

function toDroidMcpServer(config: McpServerConfig): Record<string, unknown> {
  if (config.type === "stdio") {
    return {
      type: "stdio",
      command: config.command,
      args: config.args ?? [],
      ...(config.env ? { env: config.env } : {}),
    };
  }
  return {
    type: config.type,
    url: config.url,
    ...(config.headers ? { headers: config.headers } : {}),
  };
}

/** Droid names MCP tools `<server>___<tool>`; only configured servers resolve. */
export function resolveDroidMcpToolIdentity(
  request: RequestPermissionRequest,
  serverNames: readonly string[],
): ACPMcpToolIdentity | null {
  const title = request.toolCall.title?.trim();
  if (!title) return null;
  for (const server of serverNames) {
    const prefix = `${server}___`;
    if (!title.startsWith(prefix)) continue;
    const tool = title.slice(prefix.length);
    return MCP_TOOL_NAME_PATTERN.test(tool) ? { server, tool } : null;
  }
  return null;
}

async function linkDroidLogin(factoryDirectory: string, factoryHome: string): Promise<void> {
  const source = join(factoryHome, DROID_LOGIN_FILE);
  const target = join(factoryDirectory, DROID_LOGIN_FILE);
  if (!existsSync(source)) return;
  try {
    await lstat(target);
  } catch {
    await symlink(source, target);
  }
}

export async function materializeDroidRoleCapsule(input: {
  command: readonly [string, ...string[]];
  config: AgentSessionConfig;
  launchContext: AgentLaunchContext;
  capsuleRoot?: string;
  factoryHome?: string;
}): Promise<ACPSessionLaunchPreparation> {
  const roleBinding = input.launchContext.roleBinding;
  if (!roleBinding) {
    throw new Error("Droid role capsule materialization requires an immutable role binding");
  }
  if (!input.launchContext.agentId) {
    throw new Error("Droid role capsule materialization requires a stable Paseo agent ID");
  }
  const commandCheck = checkDroidACPRoleCommand(input.command);
  if (!commandCheck.ok) {
    throw new Error(commandCheck.reason);
  }
  const mcpServers = input.config.mcpServers ?? {};
  if (!mcpServers[PASEO_MCP_SERVER_NAME]) {
    throw new Error(
      "Factory Droid role launch requires the runtime Paseo MCP server for the mandatory Beads checkpoint",
    );
  }

  const agentToken = sha256(input.launchContext.agentId).slice(0, 12);
  const bindingToken = sha256(roleBinding.instructions).slice(0, 12);
  const capsuleRoot = input.capsuleRoot ?? join(homedir(), ".paseo", "role-capsules", "droid");
  const home = join(capsuleRoot, `paseo-${roleBinding.roleId}-${agentToken}-${bindingToken}`);
  const factoryDirectory = join(home, ".factory");
  await mkdir(factoryDirectory, { recursive: true, mode: 0o700 });

  await writeExclusiveOrVerify(
    join(factoryDirectory, "AGENTS.md"),
    `${roleBinding.instructions}\n`,
  );
  // Rewritten on every launch: the runtime MCP URL and capability token change per daemon run.
  await writeFile(
    join(factoryDirectory, "mcp.json"),
    `${JSON.stringify(
      {
        mcpServers: Object.fromEntries(
          Object.entries(mcpServers).map(([name, server]) => [name, toDroidMcpServer(server)]),
        ),
      },
      null,
      2,
    )}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  // Reuse the Human's existing Droid login without Paseo reading it.
  await linkDroidLogin(factoryDirectory, input.factoryHome ?? join(homedir(), ".factory"));

  const serverNames = Object.keys(mcpServers);
  return {
    env: { [DROID_HOME_ENV]: home },
    forwardMcpServers: false,
    resolveMcpToolIdentity: (request) => resolveDroidMcpToolIdentity(request, serverNames),
  };
}

export class DroidACPAgentClient extends GenericACPAgentClient {
  private readonly roleCommand: [string, ...string[]];
  private readonly roleCapsuleRoot?: string;
  private readonly factoryHome?: string;

  constructor(options: DroidACPAgentClientOptions) {
    super({
      logger: options.logger,
      command: options.command,
      env: options.env,
      providerId: options.providerId,
      label: options.label,
      providerParams: options.providerParams,
    });
    this.roleCommand = options.command;
    this.roleCapsuleRoot = options.roleCapsuleRoot;
    this.factoryHome = options.factoryHome;
  }

  protected override async prepareSessionLaunch(
    config: AgentSessionConfig,
    launchContext?: AgentLaunchContext,
  ): Promise<ACPSessionLaunchPreparation | undefined> {
    if (!launchContext?.roleBinding) {
      // Unbound sessions keep the Human's own Droid home; ACP MCP would crash the worker.
      return { forwardMcpServers: false };
    }
    return materializeDroidRoleCapsule({
      command: this.roleCommand,
      config,
      launchContext,
      capsuleRoot: this.roleCapsuleRoot,
      factoryHome: this.factoryHome,
    });
  }
}
