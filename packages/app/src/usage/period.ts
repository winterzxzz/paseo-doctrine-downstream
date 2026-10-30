import type { Theme } from "@/styles/theme";
import type { UsageTone, UsageWindow } from "./types";

/** How long a usage window runs, so every view gives the same period the same colour. */
export type UsagePeriod = "session" | "weekly" | "monthly" | "other";

/**
 * The window's period, read from its id (scoped ids end in ":<name>") or its short label.
 * Sources name these the same way: "five_hour"/"5h", "weekly"/"wk …", "monthly"/"mo".
 */
export function usagePeriod(window: Pick<UsageWindow, "id" | "shortLabel">): UsagePeriod {
  const id = (window.id.split(":").pop() ?? window.id).toLowerCase();
  const short = (window.shortLabel ?? "").toLowerCase();
  if (id === "five_hour" || id === "five-hour" || id === "session" || short === "5h") {
    return "session";
  }
  if (id.startsWith("weekly") || id.startsWith("seven_day") || /^wk\b/.test(short)) {
    return "weekly";
  }
  if (id.startsWith("monthly") || short === "mo") return "monthly";
  return "other";
}

/**
 * A period's colour, from the active theme's terminal palette so it follows the theme. A window
 * close to its limit takes the danger colour instead, so a full ring still reads as a warning.
 */
export function usagePeriodColor(period: UsagePeriod, tone: UsageTone, theme: Theme): string {
  if (tone === "danger") return theme.colors.statusDanger;
  const ansi = theme.colors.terminal;
  switch (period) {
    case "session":
      return ansi.blue;
    case "weekly":
      return ansi.magenta;
    case "monthly":
      return ansi.yellow;
    default:
      return ansi.cyan;
  }
}
