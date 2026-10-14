import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discover, fetchUsage } from "./usage.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const limits = {
  usesTokenRateLimitsBilling: true,
  limits: {
    standard: {
      fiveHour: { usedPercent: 72, windowEnd: "2026-10-06T07:39:58.600Z", secondsRemaining: 1 },
      weekly: { usedPercent: 12, windowEnd: "2026-10-10T11:52:17.863Z", secondsRemaining: 1 },
      monthly: { usedPercent: 3, windowEnd: "2026-11-02T11:52:17.863Z", secondsRemaining: 1 },
    },
    core: {
      fiveHour: { usedPercent: 0, windowEnd: null, secondsRemaining: null },
      weekly: { usedPercent: 0, windowEnd: null, secondsRemaining: null },
      monthly: { usedPercent: 0, windowEnd: null, secondsRemaining: null },
    },
  },
  extraUsageBalanceCents: 0,
  extraUsageAllowed: true,
};

describe("factory droid usage source", () => {
  let homeDir: string;
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), "factory-droid-usage-"));
    originalEnv = { ...process.env };
    process.env["HOME"] = homeDir;
    process.env["USERPROFILE"] = homeDir;
    delete process.env["FACTORY_API_KEY"];
  });

  afterEach(() => {
    rmSync(homeDir, { recursive: true, force: true });
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    vi.restoreAllMocks();
  });

  it("reads the key from ~/.factory/.env and maps active limit windows", async () => {
    mkdirSync(join(homeDir, ".factory"), { recursive: true });
    writeFileSync(join(homeDir, ".factory", ".env"), "FACTORY_API_KEY=fk-test-key\n");
    const fetchApi = vi.fn(async () => jsonResponse(limits));

    const accounts = await discover();
    expect(accounts).toEqual([
      { key: "default", input: { store: "file", locator: join(homeDir, ".factory", ".env") } },
    ]);
    const report = await fetchUsage(
      accounts[0]!.input as never,
      fetchApi as unknown as typeof fetch,
    );

    expect(fetchApi).toHaveBeenCalledWith(
      "https://api.factory.ai/api/billing/limits",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer fk-test-key" }),
      }),
    );
    expect(report).toMatchObject({
      status: "available",
      balances: [],
      windows: [
        { id: "five_hour", label: "Session", usedPct: 72, tone: "warning" },
        { id: "weekly", label: "Weekly", usedPct: 12, resetsAt: "2026-10-10T11:52:17.863Z" },
        { id: "monthly", label: "Monthly", usedPct: 3, remainingPct: 97 },
      ],
    });
  });

  it("discovers nothing without a key and reports a rejected key as unavailable", async () => {
    expect(await discover()).toEqual([]);

    process.env["FACTORY_API_KEY"] = "fk-env-key";
    const accounts = await discover();
    expect(accounts).toEqual([
      { key: "default", input: { store: "env", locator: "FACTORY_API_KEY" } },
    ]);
    const fetchApi = vi.fn(async () => jsonResponse({}, 401));
    const report = await fetchUsage(
      accounts[0]!.input as never,
      fetchApi as unknown as typeof fetch,
    );
    expect(report).toMatchObject({ status: "unavailable", problem: { kind: "rejected" } });
  });
});
