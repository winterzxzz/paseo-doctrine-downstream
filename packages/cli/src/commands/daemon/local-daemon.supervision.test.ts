import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

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

import { DEFAULT_STOP_TIMEOUT_MS, launchLocalDaemon } from "./local-daemon.js";

const home = path.join(os.tmpdir(), "paseo-local-daemon-supervision");

function expectSupervisorLaunch(argv: string[]): void {
  const joined = argv.join(" ");
  expect(joined).toContain("supervisor-entrypoint");
  expect(joined).not.toContain("src/server/index.ts");
  expect(joined).not.toContain("dist/server/server/index.js");
  expect(joined).not.toContain("src/server/daemon-worker.ts");
  expect(joined).not.toContain("dist/server/server/daemon-worker.js");
}

describe("local daemon launch supervision", () => {
  afterEach(() => {
    launches.splice(0);
    vi.unstubAllEnvs();
  });

  test("default stop budget covers the supervised graceful cleanup window", () => {
    expect(DEFAULT_STOP_TIMEOUT_MS).toBeGreaterThan(30_000);
  });

  test.each([
    ["background", false, "managed"],
    ["foreground", true, "deployment"],
  ] as const)(
    "%s start launches supervisor-entrypoint, never a worker entry",
    async (_label, foreground, mode) => {
      await launchLocalDaemon({ home, foreground });

      expect(launches).toHaveLength(1);
      expect(launches[0]?.command).toBe(process.execPath);
      expect(launches[0]?.mode).toBe(mode);
      expectSupervisorLaunch(launches[0]?.args ?? []);
    },
  );

  test.skipIf(process.platform === "win32")(
    "background start appends known user binary directories to PATH",
    async () => {
      const userHome = path.join(os.tmpdir(), "paseo-path-user");
      vi.stubEnv("HOME", userHome);
      vi.stubEnv("PATH", ["/usr/bin", "/bin"].join(path.delimiter));

      await launchLocalDaemon({ home });

      expect(launches[0]?.env.PATH?.split(path.delimiter)).toEqual([
        "/usr/bin",
        "/bin",
        path.join(userHome, "bin"),
        path.join(userHome, ".local", "bin"),
        path.join(userHome, ".opencode", "bin"),
        path.join(userHome, ".bun", "bin"),
      ]);
    },
  );

  test.skipIf(process.platform === "win32")(
    "foreground start preserves PATH precedence and does not duplicate user binary directories",
    async () => {
      const userHome = path.join(os.tmpdir(), "paseo-path-user");
      const openCodeBin = path.join(userHome, ".opencode", "bin");
      vi.stubEnv("HOME", userHome);
      vi.stubEnv("PATH", [openCodeBin, "/usr/bin"].join(path.delimiter));

      await launchLocalDaemon({ home, foreground: true });

      expect(launches[0]?.env.PATH?.split(path.delimiter)).toEqual([
        openCodeBin,
        "/usr/bin",
        path.join(userHome, "bin"),
        path.join(userHome, ".local", "bin"),
        path.join(userHome, ".bun", "bin"),
      ]);
    },
  );
});
