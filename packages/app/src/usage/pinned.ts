import { formatPct } from "./format";
import { displayPercent } from "./model";
import { effectiveUsagePins, type UsagePreferences } from "./preferences";
import { usagePeriod, type UsagePeriod } from "./period";
import { windowTone } from "./tone";
import type { UsageReportEntry, UsageTone } from "./types";

/** One summary window of one account, as the sidebar Usage item shows it. */
export interface PinnedUsageWindow {
  key: string;
  /** Accessible description, including the source, account, window and percent meaning. */
  label: string;
  /** The window's short name ("5h"), empty for none, or its label when the source sends none. */
  shortLabel: string;
  /** The share shown, under the user's used/remaining preference. */
  percent: number;
  percentText: string;
  tone: UsageTone;
  /** Which colour the window's ring takes. */
  period: UsagePeriod;
}

/** One account's summary windows, under its source's icon. */
export interface PinnedUsageSource {
  key: string;
  icon: string | null;
  windows: PinnedUsageWindow[];
}

/** How much of each window the one-line summary has room for; every window always shows its ring. */
export type PinnedUsageLayout = "labels" | "percents";

/**
 * The richest layout that fits on one line: each window's ring, percent and short label, else
 * ring and percent alone. Until the widths are known it shows labels.
 */
export function choosePinnedUsageLayout(input: {
  available: number | null;
  labelsWidth: number | null;
  percentsWidth: number | null;
}): PinnedUsageLayout {
  const { available, labelsWidth, percentsWidth } = input;
  if (available === null || labelsWidth === null || percentsWidth === null) return "labels";
  if (labelsWidth <= available) return "labels";
  return percentsWidth < labelsWidth ? "percents" : "labels";
}

function describe(entry: UsageReportEntry, windowLabel: string): string {
  const account = entry.account.label ? ` (${entry.account.label})` : "";
  return `${entry.sourceLabel}${account} ${windowLabel}`;
}

/** Reports with every account of a source together, sources in the order they first appear. */
function groupBySource(reports: readonly UsageReportEntry[]): UsageReportEntry[] {
  const sourceIds = [...new Set(reports.map((entry) => entry.sourceId))];
  return sourceIds.flatMap((sourceId) => reports.filter((entry) => entry.sourceId === sourceId));
}

/**
 * The sidebar Usage item's summary: one group per account, grouped by source, each with its
 * windows in its report's order. Accounts with nothing to show are left out.
 */
export function resolvePinnedUsage(
  reports: readonly UsageReportEntry[],
  preferences: UsagePreferences,
): PinnedUsageSource[] {
  const pins = effectiveUsagePins(preferences, reports);
  const meaning = preferences.displayAs === "remaining" ? "left" : "used";
  return groupBySource(reports).flatMap((entry) => {
    if (entry.report.status !== "available") return [];
    const windows = entry.report.windows
      .filter(
        (window) =>
          displayPercent(window, preferences.displayAs) !== null &&
          pins.some((pin) => pin.sourceId === entry.sourceId && pin.windowId === window.id),
      )
      .map((window) => {
        const percent = displayPercent(window, preferences.displayAs) ?? 0;
        const percentText = formatPct(percent);
        return {
          key: `${entry.id}/${window.id}`,
          label: `${describe(entry, window.label)} ${percentText} ${meaning}`,
          shortLabel: window.shortLabel ?? window.label,
          percent,
          percentText,
          tone: windowTone(window),
          period: usagePeriod(window),
        };
      });
    if (windows.length === 0) return [];
    return [{ key: entry.id, icon: entry.icon ?? null, windows }];
  });
}
