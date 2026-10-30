import { describe, expect, it, vi } from "vitest";
import {
  MONO_FONT_OPTIONS,
  customFontLabel,
  fontOptionFor,
  resolveFontOptions,
} from "./font-options";

vi.mock("./font-availability", () => ({
  isFontFamilyAvailable: (face: string) => face === "Menlo",
}));

describe("resolveFontOptions", () => {
  it("offers the system default plus the installed faces", () => {
    expect(resolveFontOptions(MONO_FONT_OPTIONS, "").map((option) => option.label)).toEqual([
      "System",
      "Menlo",
    ]);
  });

  it("keeps a saved face that is not a preset, labelled by its first family", () => {
    const options = resolveFontOptions(MONO_FONT_OPTIONS, "'Iosevka Term', monospace");
    expect(options.map((option) => option.label)).toEqual(["System", "Menlo", "Iosevka Term"]);
    expect(fontOptionFor(options, " 'Iosevka Term', monospace ")?.label).toBe("Iosevka Term");
  });
});

describe("customFontLabel", () => {
  it("strips quotes and fallbacks", () => {
    expect(customFontLabel('"Berkeley Mono", Menlo, monospace')).toBe("Berkeley Mono");
  });
});
