import { existsSync, promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Logger } from "pino";
import { z } from "zod";
import type {
  ProviderUsage,
  ProviderUsageBalance,
  ProviderUsageWindow,
} from "../../../server/messages.js";
import type { ProviderApiFetch, ProviderUsageFetcher } from "../provider.js";
import {
  ApiNullableNumberSchema,
  ApiOptionalStringSchema,
  fetchProviderApi,
  toneFromUsedPct,
  unavailableUsage,
  windowFromUsedPct,
} from "../usage.js";

// Factory publishes no usage API; this is the endpoint its web app reads, so the shape is
// parsed defensively and anything unexpected degrades to an unavailable card.
const FACTORY_BILLING_LIMITS_URL = "https://api.factory.ai/api/billing/limits";

const FactoryLimitWindowSchema = z.object({
  usedPercent: ApiNullableNumberSchema.optional(),
  windowEnd: ApiOptionalStringSchema.nullable(),
});

const FactoryLimitPoolSchema = z.object({
  fiveHour: FactoryLimitWindowSchema.optional(),
  weekly: FactoryLimitWindowSchema.optional(),
  monthly: FactoryLimitWindowSchema.optional(),
});

const FactoryBillingLimitsSchema = z.object({
  usesTokenRateLimitsBilling: z.boolean().optional(),
  limits: z
    .object({
      standard: FactoryLimitPoolSchema.optional(),
      core: FactoryLimitPoolSchema.optional(),
    })
    .optional(),
  extraUsageBalanceCents: ApiNullableNumberSchema.optional(),
  extraUsageAllowed: z.boolean().optional(),
});

type FactoryLimitPool = z.infer<typeof FactoryLimitPoolSchema>;

const POOL_WINDOWS = [
  { field: "fiveHour", id: "five_hour", label: "Session" },
  { field: "weekly", id: "weekly", label: "Weekly" },
  { field: "monthly", id: "monthly", label: "Monthly" },
] as const;

interface FactoryDroidQuotaProviderOptions {
  logger: Logger;
  fetch?: ProviderApiFetch;
  homeDir?: string;
}

export class FactoryDroidQuotaProvider implements ProviderUsageFetcher {
  readonly providerId = "factory-droid";
  readonly displayName = "Factory Droid";

  private readonly logger: Logger;
  private readonly fetchApi: ProviderApiFetch;
  private readonly homeDir?: string;

  constructor(options: FactoryDroidQuotaProviderOptions) {
    this.logger = options.logger;
    this.fetchApi = options.fetch ?? fetch;
    this.homeDir = options.homeDir;
  }

  async fetchUsage(): Promise<ProviderUsage> {
    const apiKey = await this.readApiKey();
    if (!apiKey) return unavailableUsage(this);

    const res = await fetchProviderApi(this.fetchApi, FACTORY_BILLING_LIMITS_URL, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "x-factory-client": "web-app",
      },
    });
    if (!res.ok) {
      this.logger.debug({ status: res.status }, "Factory Droid usage fetch failed");
      return unavailableUsage(this);
    }

    const parsed = FactoryBillingLimitsSchema.safeParse(await res.json());
    if (!parsed.success || !parsed.data.limits) {
      this.logger.debug({ error: parsed.error?.message }, "Factory Droid usage shape changed");
      return unavailableUsage(this);
    }

    const windows = [
      ...poolWindows(parsed.data.limits.standard, null),
      ...poolWindows(parsed.data.limits.core, "Core"),
    ];
    const balances: ProviderUsageBalance[] = [];
    const extraCents = parsed.data.extraUsageBalanceCents;
    if (parsed.data.extraUsageAllowed && typeof extraCents === "number" && extraCents > 0) {
      balances.push({
        id: "extra_usage",
        label: "Extra usage",
        remaining: extraCents / 100,
        unit: "usd",
      });
    }

    return {
      providerId: this.providerId,
      displayName: this.displayName,
      status: "available",
      planLabel: null,
      windows,
      balances,
      details: [],
      error: null,
    };
  }

  /** `FACTORY_API_KEY` from the daemon environment, else Droid's own `~/.factory/.env`. */
  private async readApiKey(): Promise<string | null> {
    const fromEnv = process.env["FACTORY_API_KEY"]?.trim();
    if (fromEnv) return fromEnv;
    const path = join(this.homeDir ?? homedir(), ".factory", ".env");
    if (!existsSync(path)) return null;
    const match = /^\s*(?:export\s+)?FACTORY_API_KEY\s*=\s*["']?([^"'\s]+)["']?\s*$/m.exec(
      await fs.readFile(path, "utf8"),
    );
    return match?.[1] ?? null;
  }
}

// A pool whose windows never started (no windowEnd) is not in use on this plan.
function poolWindows(
  pool: FactoryLimitPool | undefined,
  prefix: string | null,
): ProviderUsageWindow[] {
  if (!pool) return [];
  const windows: ProviderUsageWindow[] = [];
  for (const spec of POOL_WINDOWS) {
    const window = pool[spec.field];
    if (!window?.windowEnd) continue;
    windows.push(
      windowFromUsedPct({
        id: prefix ? `${prefix.toLowerCase()}_${spec.id}` : spec.id,
        label: prefix ? `${prefix} ${spec.label.toLowerCase()}` : spec.label,
        utilizationPct: window.usedPercent,
        resetsAt: window.windowEnd,
        tone: toneFromUsedPct(window.usedPercent),
      }),
    );
  }
  return windows;
}
