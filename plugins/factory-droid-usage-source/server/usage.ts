import type { UsageInput } from "../shared/input.js";
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import {
  toneFromUsedPct,
  unavailable,
  type UsageAccount,
  type UsageBalance,
  type UsageReport,
  type UsageWindow,
  windowFromUsedPct,
} from "@getpaseo/plugin/server/usage";

// Factory publishes no usage API; this is the endpoint its web app reads, so the shape is
// parsed defensively and anything unexpected degrades to an error card.
const FACTORY_BILLING_LIMITS_URL = "https://api.factory.ai/api/billing/limits";

const ApiNullableNumberSchema = z.preprocess(
  (value) => (value == null ? null : value),
  z.coerce.number().finite().nullable(),
);

const FactoryLimitWindowSchema = z.object({
  usedPercent: ApiNullableNumberSchema.optional(),
  windowEnd: z.string().nullish(),
});

const FactoryLimitPoolSchema = z.object({
  fiveHour: FactoryLimitWindowSchema.optional(),
  weekly: FactoryLimitWindowSchema.optional(),
  monthly: FactoryLimitWindowSchema.optional(),
});

const FactoryBillingLimitsSchema = z.object({
  usesTokenRateLimitsBilling: z.boolean().optional(),
  limits: z.object({
    standard: FactoryLimitPoolSchema.optional(),
    core: FactoryLimitPoolSchema.optional(),
  }),
  extraUsageBalanceCents: ApiNullableNumberSchema.optional(),
  extraUsageAllowed: z.boolean().optional(),
});

type FactoryLimitPool = z.infer<typeof FactoryLimitPoolSchema>;

const POOL_WINDOWS = [
  { field: "fiveHour", id: "five_hour", label: "Session", shortLabel: "5h" },
  { field: "weekly", id: "weekly", label: "Weekly", shortLabel: "wk" },
  { field: "monthly", id: "monthly", label: "Monthly", shortLabel: "mo" },
] as const;

export async function fetchUsage(
  input: UsageInput,
  fetchApi: typeof fetch = fetch,
): Promise<UsageReport> {
  const apiKey = await readApiKey(input);
  if (!apiKey) throw new Error("Factory Droid login store no longer exists");

  const res = await fetchApi(FACTORY_BILLING_LIMITS_URL, {
    signal: AbortSignal.timeout(15_000),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "x-factory-client": "web-app",
    },
  });
  if (res.status === 401 || res.status === 403) {
    return unavailable({ kind: "rejected", status: res.status, refreshedBy: "droid" });
  }
  if (!res.ok) throw new Error(`Factory usage API returned ${res.status}`);

  const parsed = FactoryBillingLimitsSchema.parse(await res.json());
  const windows = [
    ...poolWindows(parsed.limits.standard, null),
    ...poolWindows(parsed.limits.core, "Core"),
  ];
  const balances: UsageBalance[] = [];
  const extraCents = parsed.extraUsageBalanceCents;
  if (parsed.extraUsageAllowed && typeof extraCents === "number" && extraCents > 0) {
    balances.push({
      id: "extra_usage",
      label: "Extra usage",
      used: null,
      remaining: extraCents / 100,
      limit: null,
      unit: "usd",
    });
  }
  return { status: "available", windows, balances, details: [] };
}

// A pool whose windows never started (no windowEnd) is not in use on this plan.
function poolWindows(pool: FactoryLimitPool | undefined, prefix: string | null): UsageWindow[] {
  if (!pool) return [];
  const windows: UsageWindow[] = [];
  for (const spec of POOL_WINDOWS) {
    const window = pool[spec.field];
    if (!window?.windowEnd) continue;
    windows.push(
      windowFromUsedPct({
        id: prefix ? `${prefix.toLowerCase()}_${spec.id}` : spec.id,
        label: prefix ? `${prefix} ${spec.label.toLowerCase()}` : spec.label,
        shortLabel: prefix ? "" : spec.shortLabel,
        utilizationPct: window.usedPercent,
        resetsAt: window.windowEnd,
        tone: toneFromUsedPct(window.usedPercent),
      }),
    );
  }
  return windows;
}

/** `FACTORY_API_KEY` from the daemon environment, else Droid's own `~/.factory/.env`. */
async function readApiKey(input: UsageInput): Promise<string | undefined> {
  if (input.store === "env") return process.env[input.locator]?.trim() || undefined;
  try {
    const match = /^\s*(?:export\s+)?FACTORY_API_KEY\s*=\s*["']?([^"'\s]+)["']?\s*$/m.exec(
      await fs.readFile(input.locator, "utf8"),
    );
    return match?.[1];
  } catch {
    return undefined;
  }
}

export async function discover(): Promise<UsageAccount[]> {
  const candidates: UsageInput[] = [
    { store: "env", locator: "FACTORY_API_KEY" },
    { store: "file", locator: join(homedir(), ".factory", ".env") },
  ];
  for (const input of candidates) if (await readApiKey(input)) return [{ key: "default", input }];
  return [];
}
