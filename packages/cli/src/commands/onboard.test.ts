import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import path from "node:path";
import { waitForDaemonReady } from "@getpaseo/server/daemon-control";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Onboarding waits on waitForDaemonReady. The supervisor first publishes its PID lock with
// listen=null and fills the bound address only once its worker is ready; readiness must never
// fall back to persisted or default config, which may name a different Paseo home's daemon.
describe("onboard readiness", () => {
  let home: string;

  beforeEach(async () => {
    home = await mkdtemp(path.join(tmpdir(), "paseo-onboard-ready-"));
    await writeFile(
      path.join(home, "config.json"),
      JSON.stringify({ version: 1, daemon: { listen: "127.0.0.1:6767" } }),
    );
  });

  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  async function writeLiveLock(listen: string | null): Promise<void> {
    await writeFile(
      path.join(home, "paseo.pid"),
      JSON.stringify({
        pid: process.pid,
        startedAt: new Date().toISOString(),
        hostname: hostname(),
        uid: process.getuid?.() ?? 0,
        listen,
      }),
    );
  }

  it("does not report a fallback address while the supervisor lock has no bound listen", async () => {
    await writeLiveLock(null);
    await expect(waitForDaemonReady(home, { timeoutMs: 250 })).rejects.toMatchObject({
      code: "DAEMON_NOT_READY",
    });
  });

  it("uses only the bound listen recorded in the live PID lock", async () => {
    await writeLiveLock("127.0.0.1:43123");
    await expect(waitForDaemonReady(home, { timeoutMs: 250 })).resolves.toMatchObject({
      listen: "127.0.0.1:43123",
    });
  });

  it("does not wait on a home without a live PID-lock owner", async () => {
    await expect(waitForDaemonReady(home, { timeoutMs: 250 })).rejects.toMatchObject({
      code: "DAEMON_NOT_RUNNING",
    });
  });
});
