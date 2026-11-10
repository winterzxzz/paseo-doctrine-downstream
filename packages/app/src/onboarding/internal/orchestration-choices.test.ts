import { describe, expect, it } from "vitest";
import { pendingOrchestrationWrites, resolveOrchestrationChoices } from "./orchestration-choices";

describe("resolveOrchestrationChoices", () => {
  it("starts from what the host has now", () => {
    expect(resolveOrchestrationChoices({}, { tools: false, skills: true, cli: false })).toEqual({
      tools: false,
      skills: true,
      cli: false,
    });
  });

  it("shows a state still being read as off", () => {
    expect(resolveOrchestrationChoices({}, { tools: null, skills: null, cli: null })).toEqual({
      tools: false,
      skills: false,
      cli: false,
    });
  });

  it("shows what the user flipped", () => {
    expect(
      resolveOrchestrationChoices({ tools: true }, { tools: false, skills: null, cli: true }),
    ).toEqual({ tools: true, skills: false, cli: true });
  });
});

describe("pendingOrchestrationWrites", () => {
  it("writes nothing when the user flipped nothing, even with tools off on the host", () => {
    expect(pendingOrchestrationWrites({}, { tools: false, skills: false, cli: false })).toEqual({});
    expect(pendingOrchestrationWrites({}, { tools: null, skills: null, cli: null })).toEqual({});
  });

  it("writes a flipped switch that differs from the host", () => {
    expect(
      pendingOrchestrationWrites(
        { tools: true, cli: false },
        { tools: false, skills: true, cli: true },
      ),
    ).toEqual({ tools: true, cli: false });
  });

  it("skips a flipped switch that already matches", () => {
    expect(
      pendingOrchestrationWrites({ tools: true }, { tools: true, skills: false, cli: false }),
    ).toEqual({});
  });

  it("writes a flipped switch whose host state is still being read", () => {
    expect(
      pendingOrchestrationWrites({ skills: true }, { tools: false, skills: null, cli: false }),
    ).toEqual({ skills: true });
  });
});
