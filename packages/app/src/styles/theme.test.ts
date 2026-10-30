import { describe, expect, it } from "vitest";
import {
  darkDraculaTheme,
  darkPureBlackTheme,
  darkTheme,
  FONT_SIZE,
  getNextThemePreference,
  lightTheme,
  THEME_OPTIONS,
} from "./theme";

describe("Typography scale", () => {
  it("names 14px as the default interface tier", () => {
    expect(FONT_SIZE).toEqual({
      xs: 12,
      code: 12,
      content: 15,
      sm: 12,
      base: 14,
      lg: 16,
      xl: 18,
      "2xl": 20,
      "3xl": 22,
      "4xl": 26,
    });
  });
});

describe("Theme catalog", () => {
  it("owns the picker and shortcut order", () => {
    expect(THEME_OPTIONS.map((option) => option.name)).toEqual([
      "light",
      "dark",
      "auto",
      "zinc",
      "midnight",
      "claude",
      "ghostty",
      "pureBlack",
      "catppuccinMocha",
      "dracula",
      "nord",
      "tokyoNight",
      "oneDark",
      "gruvbox",
      "rosePine",
      "everforest",
      "catppuccinLatte",
      "solarizedLight",
      "githubLight",
    ]);
    expect(getNextThemePreference("dark")).toBe("auto");
    expect(getNextThemePreference("pureBlack")).toBe("catppuccinMocha");
    expect(getNextThemePreference("githubLight")).toBe("light");
  });
});

describe("Community themes", () => {
  it("registers each palette with the color scheme it was ported from", () => {
    const schemes = Object.fromEntries(
      THEME_OPTIONS.filter((option) => option.name !== "auto").map((option) => [
        option.name,
        option.theme.colorScheme,
      ]),
    );
    expect(schemes).toMatchObject({
      dracula: "dark",
      nord: "dark",
      catppuccinLatte: "light",
      solarizedLight: "light",
      githubLight: "light",
    });
  });

  it("uses the palette's own terminal colors", () => {
    expect(darkDraculaTheme.colors.terminal.background).toBe("#282a36");
    expect(darkDraculaTheme.colors.terminal.magenta).toBe("#ff79c6");
    expect(darkTheme.colors.terminal.magenta).toBe("#b07ad0");
  });
});

describe("Pure black theme", () => {
  it("uses a pure black application and terminal background", () => {
    expect(darkPureBlackTheme.colors.surface0).toBe("#000000");
    expect(darkPureBlackTheme.colors.background).toBe("#000000");
    expect(darkPureBlackTheme.colors.terminal.background).toBe("#000000");
  });

  it("uses Paseo's muted green accent", () => {
    expect(darkPureBlackTheme.colors.accent).toBe("#20744A");
    expect(darkPureBlackTheme.colors.accentBright).toBe("#7ccba0");
  });

  it("derives sidebar interaction surfaces from the surface scale", () => {
    expect(darkPureBlackTheme.colors.surfaceSidebar).toBe("#000000");
    expect(darkPureBlackTheme.colors.surfaceSidebarHover).toBe(darkPureBlackTheme.colors.surface1);
    expect(darkPureBlackTheme.colors.surfaceSidebarSelected).toBe(
      darkPureBlackTheme.colors.surface2,
    );
  });

  it("keeps ANSI black output readable on its zero-luminance terminal background", () => {
    expect(darkPureBlackTheme.colors.terminal.black).toBe("#595959");
    expect(darkPureBlackTheme.colors.terminal.brightBlack).toBe("#8a8a8a");
  });
});

describe("Sidebar interaction surfaces", () => {
  it("keeps Light selection distinct from the sidebar surface", () => {
    expect(lightTheme.colors.surfaceSidebarHover).toBe(lightTheme.colors.surface1);
    expect(lightTheme.colors.surfaceSidebarSelected).toBe(lightTheme.colors.surface3);
    expect(lightTheme.colors.surfaceSidebarSelected).not.toBe(lightTheme.colors.surfaceSidebar);
  });

  it("derives Dark hover and selection from the first two raised surfaces", () => {
    expect(darkTheme.colors.surfaceSidebarHover).toBe(darkTheme.colors.surface1);
    expect(darkTheme.colors.surfaceSidebarSelected).toBe(darkTheme.colors.surface2);
  });
});

describe("Built-in light theme", () => {
  it("preserves its authored aliases and terminal contrast through the semantic builder", () => {
    expect(lightTheme.colors).toMatchObject({
      primary: "#18181b",
      primaryForeground: "#fafafa",
      destructiveForeground: "#ffffff",
      successForeground: "#ffffff",
      terminal: {
        black: "#1a1a1e",
        brightBlack: "#3f3f46",
      },
    });
  });
});
