import { useCallback } from "react";
import { DEFAULT_THEME_PREFERENCE, useAppSettings } from "@/hooks/use-settings";
import {
  ThemePicker as ThemePickerGrid,
  type BuiltInThemePreference,
} from "@/screens/settings/appearance/theme-picker";
import { PLUGIN_THEME_PREFERENCE } from "@/styles/theme";
import { useContributedThemes } from "./provider";

/**
 * The theme grid bound to the app settings. Picking a card applies the theme to the whole app at
 * once. Settings → Appearance and first-run setup share it.
 */
export function ThemePicker() {
  const { settings, updateSettings } = useAppSettings();
  const { options: pluginThemes, selected: selectedPluginTheme, select } = useContributedThemes();
  // A selected contribution that is no longer installed shows the fallback the app renders.
  const builtInValue =
    settings.theme === PLUGIN_THEME_PREFERENCE ? DEFAULT_THEME_PREFERENCE : settings.theme;

  const selectBuiltIn = useCallback(
    (theme: BuiltInThemePreference) => {
      void updateSettings({ theme });
    },
    [updateSettings],
  );

  return (
    <ThemePickerGrid
      value={builtInValue}
      pluginThemes={pluginThemes}
      selectedPluginTheme={selectedPluginTheme}
      onChange={selectBuiltIn}
      onSelectPluginTheme={select}
    />
  );
}
