import { describe, expect, it } from "vitest";
import { assertDaemonConfigHumanContext } from "./config.js";

describe("daemon config Human-only guard", () => {
  it("lets a Human change daemon settings", () => {
    expect(() => assertDaemonConfigHumanContext({})).not.toThrow();
    expect(() => assertDaemonConfigHumanContext({ PASEO_AGENT_ID: "  " })).not.toThrow();
  });

  it("refuses a Paseo agent before any setting is written", () => {
    expect(() => assertDaemonConfigHumanContext({ PASEO_AGENT_ID: "agent-1" })).toThrow(
      expect.objectContaining({ code: "DAEMON_CONFIG_HUMAN_REQUIRED" }),
    );
  });
});
