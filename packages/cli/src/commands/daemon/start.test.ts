import os from "node:os";
import path from "node:path";
import type { Command } from "commander";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

type StartDaemonInstanceInput = Parameters<
  typeof import("@getpaseo/server/daemon-control").startDaemonInstance
>[0];

const launches = vi.hoisted(() => [] as StartDaemonInstanceInput[]);

vi.mock("@getpaseo/server/daemon-control", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@getpaseo/server/daemon-control")>();
  return {
    ...actual,
    startDaemonInstance: vi.fn(async (input: StartDaemonInstanceInput) => {
      launches.push(input);
      return {
        instance: {
          pid: 4242,
          startedAt: new Date().toISOString(),
          hostname: "test-host",
          uid: 0,
          listen: "127.0.0.1:43123",
        },
        spawned: true,
        ...(input.foreground ? { exitCode: 0 } : {}),
      };
    }),
  };
});

import { daemonLaunchEnvironment } from "@getpaseo/server/daemon-control";
import { daemonRunCommand, startCommand } from "./start.js";

const home = path.join(os.tmpdir(), "paseo-legacy-foreground-start");
const listen = "127.0.0.1:43123";

function parse(command: Command, args: string[]) {
  return command.parseAsync([...args, "--home", home], { from: "user" });
}

// COMPAT(legacyForegroundLaunchFlags): added in v0.9.2-paseo.60, remove after 2027-03-25 once the web-cli installer launches with paseo daemon run
describe("legacy foreground launch flags on daemon start", () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    launches.splice(0);
    process.exitCode = undefined;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test("the web-cli installer invocation runs the daemon run foreground path with deployment overrides", async () => {
    await parse(startCommand(), ["--foreground", "--listen", listen, "--web-ui", "--no-relay"]);

    expect(launches).toHaveLength(1);
    const launch = launches[0]!;
    expect(launch.foreground).toBe(true);
    expect(launch.mode).toBe("deployment");
    expect(launch.home).toBe(home);
    expect(launch.env).toMatchObject({
      PASEO_LISTEN: listen,
      PASEO_WEB_UI_ENABLED: "true",
      PASEO_RELAY_ENABLED: "false",
    });
    // The supervisor receives exactly what startDaemonInstance spawns it with.
    expect(daemonLaunchEnvironment(launch)).toMatchObject({
      PASEO_HOME: home,
      PASEO_LISTEN: listen,
      PASEO_WEB_UI_ENABLED: "true",
      PASEO_RELAY_ENABLED: "false",
    });
    expect(process.exitCode).toBe(0);
  });

  test("matches daemon run given the same deployment environment", async () => {
    await parse(startCommand(), ["--foreground", "--listen", listen, "--web-ui", "--no-relay"]);
    vi.stubEnv("PASEO_LISTEN", listen);
    vi.stubEnv("PASEO_WEB_UI_ENABLED", "true");
    vi.stubEnv("PASEO_RELAY_ENABLED", "false");
    await parse(daemonRunCommand(), []);

    const [legacy, run] = launches.map((launch) => daemonLaunchEnvironment(launch));
    expect(launches.map(({ mode, foreground }) => ({ mode, foreground }))).toEqual([
      { mode: "deployment", foreground: true },
      { mode: "deployment", foreground: true },
    ]);
    for (const key of ["PASEO_HOME", "PASEO_LISTEN", "PASEO_WEB_UI_ENABLED", "PASEO_RELAY_ENABLED"])
      expect(legacy?.[key]).toBe(run?.[key]);
  });

  test("--port and the opposite toggles translate like the removed launcher", async () => {
    await parse(startCommand(), ["--foreground", "--port", "43124", "--no-web-ui", "--relay"]);

    expect(launches[0]?.env).toMatchObject({
      PASEO_LISTEN: "127.0.0.1:43124",
      PASEO_WEB_UI_ENABLED: "false",
      PASEO_RELAY_ENABLED: "true",
    });
  });

  test.each([
    [["--listen", listen]],
    [["--web-ui"]],
    [["--no-relay"]],
    [["--foreground", "--no-mcp"]],
    [["--foreground", "--hostnames", "example.com"]],
  ])("start %j still fails with REMOVED_LAUNCH_OPTION before launching", async (args) => {
    await expect(parse(startCommand(), args)).rejects.toMatchObject({
      code: "REMOVED_LAUNCH_OPTION",
    });
    expect(launches).toHaveLength(0);
  });

  test("daemon run does not accept the legacy flags", async () => {
    await expect(parse(daemonRunCommand(), ["--listen", listen])).rejects.toMatchObject({
      code: "REMOVED_LAUNCH_OPTION",
    });
    expect(launches).toHaveLength(0);
  });
});
