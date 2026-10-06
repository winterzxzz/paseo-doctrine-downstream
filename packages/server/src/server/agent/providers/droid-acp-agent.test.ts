import { lstat, mkdir, mkdtemp, readFile, readlink, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RequestPermissionRequest } from "@agentclientprotocol/sdk";
import { describe, expect, test } from "vitest";

import { materializeDroidRoleCapsule, resolveDroidMcpToolIdentity } from "./droid-acp-agent.js";
import { checkDroidACPRoleCommand, isDroidLaunchCommand } from "./droid-acp-command.js";

const NPX_DROID = ["npx", "-y", "droid@0.233.0", "exec", "--output-format", "acp-daemon"] as const;

function permission(title: string): RequestPermissionRequest {
  return {
    sessionId: "session-1",
    toolCall: { toolCallId: "tool-1", title, kind: "other", status: "pending" },
    options: [],
  };
}

describe("Factory Droid ACP launch shape", () => {
  test("accepts the direct and npx ACP daemon launches", () => {
    expect(checkDroidACPRoleCommand(["droid", "exec", "--output-format", "acp-daemon"])).toEqual({
      ok: true,
    });
    expect(checkDroidACPRoleCommand([...NPX_DROID])).toEqual({ ok: true });
    expect(isDroidLaunchCommand(["/usr/local/bin/droid", "exec"])).toBe(true);
    expect(isDroidLaunchCommand(["cursor-agent", "acp"])).toBe(false);
    expect(isDroidLaunchCommand(["npx", "-y", "droidish@1.0.0", "exec"])).toBe(false);
  });

  test("rejects launches that bring their own autonomy, prompt, settings or session", () => {
    for (const extra of [
      ["--auto", "high"],
      ["--skip-permissions-unsafe"],
      ["--append-system-prompt-file", "/tmp/x"],
      ["--settings=/tmp/settings.json"],
      ["--cwd", "/tmp"],
    ]) {
      expect(checkDroidACPRoleCommand([...NPX_DROID, ...extra]).ok).toBe(false);
    }
    expect(checkDroidACPRoleCommand(["droid", "exec", "--output-format", "text"]).ok).toBe(false);
    expect(checkDroidACPRoleCommand(["droid", "--output-format", "acp-daemon"]).ok).toBe(false);
  });
});

describe("Factory Droid role capsule", () => {
  test("binds role bytes, runtime MCP and the existing login inside a private Droid home", async () => {
    const root = await mkdtemp(join(tmpdir(), "paseo-droid-role-test-"));
    try {
      const factoryHome = join(root, "user-factory");
      await mkdir(factoryHome, { recursive: true });
      await writeFile(join(factoryHome, "auth.v2.loginkeychain"), "login");
      const launch = {
        command: NPX_DROID,
        config: {
          provider: "factory-droid",
          cwd: "/workspace/repo",
          mcpServers: {
            paseo: {
              type: "http" as const,
              url: "http://127.0.0.1:6767/mcp/agents?callerAgentId=agent-sup",
              headers: { Authorization: "Bearer runtime-token" },
            },
          },
        },
        launchContext: {
          agentId: "agent-sup",
          roleBinding: {
            roleId: "supervisor" as const,
            instructions: "Immutable Supervisor bytes",
          },
        },
        capsuleRoot: join(root, "capsules"),
        factoryHome,
      };

      const prepared = await materializeDroidRoleCapsule(launch);
      const home = prepared.env?.["FACTORY_HOME_OVERRIDE"];
      expect(home).toMatch(/paseo-supervisor-[a-f0-9]{12}-[a-f0-9]{12}$/u);
      expect(prepared.forwardMcpServers).toBe(false);
      const factoryDirectory = join(home!, ".factory");
      expect(await readFile(join(factoryDirectory, "AGENTS.md"), "utf8")).toBe(
        "Immutable Supervisor bytes\n",
      );
      expect(JSON.parse(await readFile(join(factoryDirectory, "mcp.json"), "utf8"))).toEqual({
        mcpServers: {
          paseo: {
            type: "http",
            url: "http://127.0.0.1:6767/mcp/agents?callerAgentId=agent-sup",
            headers: { Authorization: "Bearer runtime-token" },
          },
        },
      });
      expect((await stat(join(factoryDirectory, "mcp.json"))).mode & 0o777).toBe(0o600);
      expect((await lstat(join(factoryDirectory, "auth.v2.loginkeychain"))).isSymbolicLink()).toBe(
        true,
      );
      expect(await readlink(join(factoryDirectory, "auth.v2.loginkeychain"))).toBe(
        join(factoryHome, "auth.v2.loginkeychain"),
      );
      expect(prepared.resolveMcpToolIdentity?.(permission("paseo___beads_status"))).toEqual({
        server: "paseo",
        tool: "beads_status",
      });

      // Resume reuses the same capsule and refreshes the runtime MCP token.
      const resumed = await materializeDroidRoleCapsule({
        ...launch,
        config: {
          ...launch.config,
          mcpServers: {
            paseo: { ...launch.config.mcpServers.paseo, headers: { Authorization: "Bearer next" } },
          },
        },
      });
      expect(resumed.env).toEqual(prepared.env);
      expect(await readFile(join(factoryDirectory, "mcp.json"), "utf8")).toContain("Bearer next");

      await expect(
        materializeDroidRoleCapsule({
          ...launch,
          launchContext: {
            ...launch.launchContext,
            roleBinding: { roleId: "supervisor", instructions: "Immutable Supervisor bytes" },
          },
          config: { ...launch.config, mcpServers: {} },
        }),
      ).rejects.toThrow("requires the runtime Paseo MCP server");
      await expect(
        materializeDroidRoleCapsule({ ...launch, command: [...NPX_DROID, "--auto", "high"] }),
      ).rejects.toThrow("Factory Droid native role binding requires");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("resolves only configured servers with safe tool names", () => {
    expect(resolveDroidMcpToolIdentity(permission("paseo___create_agent"), ["paseo"])).toEqual({
      server: "paseo",
      tool: "create_agent",
    });
    expect(resolveDroidMcpToolIdentity(permission("other___beads_status"), ["paseo"])).toBeNull();
    expect(resolveDroidMcpToolIdentity(permission("Execute rm -rf"), ["paseo"])).toBeNull();
    expect(resolveDroidMcpToolIdentity(permission("paseo___a b"), ["paseo"])).toBeNull();
  });
});
