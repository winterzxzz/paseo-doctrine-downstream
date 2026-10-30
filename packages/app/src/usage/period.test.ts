import { describe, expect, it } from "vitest";
import { usagePeriod } from "./period";

describe("usagePeriod", () => {
  it("reads the period from the window id or short label", () => {
    expect(usagePeriod({ id: "five_hour", shortLabel: "5h" })).toBe("session");
    expect(usagePeriod({ id: "weekly", shortLabel: "wk" })).toBe("weekly");
    expect(usagePeriod({ id: "weekly_fable", shortLabel: "wk Fable" })).toBe("weekly");
    expect(usagePeriod({ id: "code_review:weekly" })).toBe("weekly");
    expect(usagePeriod({ id: "monthly", shortLabel: "mo" })).toBe("monthly");
  });

  it("leaves windows of unknown length as other", () => {
    expect(usagePeriod({ id: "rolling", shortLabel: "" })).toBe("other");
    expect(usagePeriod({ id: "unknown_primary", shortLabel: "" })).toBe("other");
  });
});
