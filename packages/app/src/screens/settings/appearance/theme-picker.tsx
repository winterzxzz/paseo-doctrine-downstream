import { memo, useCallback, useMemo } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import { Check } from "lucide-react-native";
import {
  darkTheme,
  ICON_SIZE,
  lightTheme,
  PLUGIN_THEME_PREFERENCE,
  THEME_OPTIONS,
  type Theme,
  type ThemePreference,
} from "@/styles/theme";
import { inlineUnistylesStyle } from "@/styles/unistyles-inline-style";
import type { PluginThemeOption } from "@/plugins/themes";

export type BuiltInThemePreference = Exclude<ThemePreference, typeof PLUGIN_THEME_PREFERENCE>;

type ThemeOption = (typeof THEME_OPTIONS)[number];
type ConcreteOption = Exclude<ThemeOption, { name: "auto" }>;

// Community palettes carry their own (untranslated) product name; the app's
// own themes are translated.
export function getThemeLabel(t: TFunction, value: BuiltInThemePreference): string {
  const option = THEME_OPTIONS.find((entry) => entry.name === value);
  if (option && "label" in option) return option.label;
  return t(`settings.appearance.theme.options.${value}`);
}

const DEFAULT_GROUP = THEME_OPTIONS.filter((option) => option.group === "primary");
const VARIANTS = THEME_OPTIONS.filter(
  (option): option is ConcreteOption => option.group !== "primary",
);
const LIGHT_GROUP = VARIANTS.filter((option) => option.theme.colorScheme === "light");
const DARK_GROUP = VARIANTS.filter((option) => option.theme.colorScheme === "dark");

const ThemedCheck = withUnistyles(Check);
const accentColorMapping = (theme: Theme) => ({ color: theme.colors.accent });

// ---------------------------------------------------------------------------
// Thumbnail: a miniature window painted in the theme's own colors — sidebar,
// two lines of text, and the accent as a button.
// ---------------------------------------------------------------------------

const ThemeThumbnail = memo(function ThemeThumbnail({ theme }: { theme: Theme }) {
  const colors = theme.colors;
  const paint = useMemo(
    () => ({
      root: inlineUnistylesStyle({ backgroundColor: colors.surface0 }),
      sidebar: inlineUnistylesStyle({
        backgroundColor: colors.surfaceSidebar,
        borderRightColor: colors.border,
      }),
      sidebarSelected: inlineUnistylesStyle({ backgroundColor: colors.surfaceSidebarSelected }),
      sidebarLine: inlineUnistylesStyle({ backgroundColor: colors.foregroundExtraMuted }),
      title: inlineUnistylesStyle({ backgroundColor: colors.foreground }),
      body: inlineUnistylesStyle({ backgroundColor: colors.foregroundMuted }),
      input: inlineUnistylesStyle({
        backgroundColor: colors.surface2,
        borderColor: colors.border,
      }),
      accent: inlineUnistylesStyle({ backgroundColor: colors.accent }),
    }),
    [colors],
  );

  return (
    <View style={[styles.thumbRoot, paint.root]}>
      <View style={[styles.thumbSidebar, paint.sidebar]}>
        <View style={[styles.thumbSidebarItem, paint.sidebarSelected]}>
          <View style={[styles.thumbSidebarLine, paint.sidebarLine]} />
        </View>
        <View style={styles.thumbSidebarItem}>
          <View style={[styles.thumbSidebarLine, styles.thumbShort, paint.sidebarLine]} />
        </View>
        <View style={styles.thumbSidebarItem}>
          <View style={[styles.thumbSidebarLine, paint.sidebarLine]} />
        </View>
      </View>
      <View style={styles.thumbMain}>
        <View style={[styles.thumbTitle, paint.title]} />
        <View style={[styles.thumbBody, paint.body]} />
        <View style={[styles.thumbBody, styles.thumbShort, paint.body]} />
        <View style={[styles.thumbInput, paint.input]}>
          <View style={[styles.thumbAccent, paint.accent]} />
        </View>
      </View>
    </View>
  );
});

function AutoThumbnail() {
  return (
    <View style={styles.autoRoot}>
      <View style={styles.autoHalf}>
        <View style={styles.autoShift}>
          <ThemeThumbnail theme={lightTheme} />
        </View>
      </View>
      <View style={[styles.autoHalf, styles.autoHalfRight]}>
        <View style={styles.autoShift}>
          <ThemeThumbnail theme={darkTheme} />
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

interface ThemeCardProps {
  label: string;
  theme: Theme | null;
  selected: boolean;
  onPress: () => void;
}

const ThemeCard = memo(function ThemeCard({ label, theme, selected, onPress }: ThemeCardProps) {
  const cardStyle = selected ? [styles.card, styles.cardSelected] : styles.card;
  const accessibilityState = useMemo(() => ({ checked: selected }), [selected]);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={accessibilityState}
      accessibilityLabel={label}
      onPress={onPress}
      style={cardStyle}
    >
      <View style={styles.thumbFrame}>
        {theme ? <ThemeThumbnail theme={theme} /> : <AutoThumbnail />}
      </View>
      <View style={styles.labelRow}>
        <Text
          style={selected ? [styles.label, styles.labelSelected] : styles.label}
          numberOfLines={1}
        >
          {label}
        </Text>
        {selected ? <ThemedCheck size={ICON_SIZE.sm} uniProps={accentColorMapping} /> : null}
      </View>
    </Pressable>
  );
});

interface BuiltInCardProps {
  option: ThemeOption;
  selected: boolean;
  onChange: (theme: BuiltInThemePreference) => void;
}

function BuiltInCard({ option, selected, onChange }: BuiltInCardProps) {
  const { t } = useTranslation();
  const handlePress = useCallback(() => onChange(option.name), [onChange, option.name]);
  return (
    <ThemeCard
      label={getThemeLabel(t, option.name)}
      theme={option.name === "auto" ? null : option.theme}
      selected={selected}
      onPress={handlePress}
    />
  );
}

interface PluginCardProps {
  option: PluginThemeOption;
  selected: boolean;
  onSelect: (option: PluginThemeOption) => void;
}

function PluginCard({ option, selected, onSelect }: PluginCardProps) {
  const handlePress = useCallback(() => onSelect(option), [onSelect, option]);
  return (
    <ThemeCard label={option.name} theme={option.theme} selected={selected} onPress={handlePress} />
  );
}

// ---------------------------------------------------------------------------
// Picker
// ---------------------------------------------------------------------------

function ThemeGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={title}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.grid}>{children}</View>
    </View>
  );
}

export interface ThemePickerProps {
  value: BuiltInThemePreference;
  pluginThemes: PluginThemeOption[];
  selectedPluginTheme: PluginThemeOption | null;
  onChange: (theme: BuiltInThemePreference) => void;
  onSelectPluginTheme: (option: PluginThemeOption) => void;
}

export function ThemePicker({
  value,
  pluginThemes,
  selectedPluginTheme,
  onChange,
  onSelectPluginTheme,
}: ThemePickerProps) {
  const { t } = useTranslation();
  const isBuiltInSelected = (name: BuiltInThemePreference) =>
    selectedPluginTheme === null && value === name;

  const renderGroup = (title: string, options: readonly ThemeOption[]) =>
    options.length > 0 ? (
      <ThemeGroup title={title}>
        {options.map((option) => (
          <BuiltInCard
            key={option.name}
            option={option}
            selected={isBuiltInSelected(option.name)}
            onChange={onChange}
          />
        ))}
      </ThemeGroup>
    ) : null;

  return (
    <View style={styles.root}>
      {renderGroup(t("settings.appearance.theme.groups.default"), DEFAULT_GROUP)}
      {renderGroup(t("settings.appearance.theme.groups.dark"), DARK_GROUP)}
      {renderGroup(t("settings.appearance.theme.groups.light"), LIGHT_GROUP)}
      {pluginThemes.length > 0 ? (
        <ThemeGroup title={t("settings.appearance.theme.groups.plugins")}>
          {pluginThemes.map((option) => (
            <PluginCard
              key={option.id}
              option={option}
              selected={selectedPluginTheme?.id === option.id}
              onSelect={onSelectPluginTheme}
            />
          ))}
        </ThemeGroup>
      ) : null}
    </View>
  );
}

const CARD_WIDTH = 132;
const THUMB_HEIGHT = 72;

const styles = StyleSheet.create((theme) => ({
  root: {
    padding: theme.spacing[4],
    gap: theme.spacing[6],
  },
  group: {
    gap: theme.spacing[3],
  },
  groupTitle: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing[3],
  },
  // Phones: two even columns that fill the row. Wider screens: fixed-width cards.
  card: {
    width: { xs: undefined, md: CARD_WIDTH },
    flexGrow: { xs: 1, md: 0 },
    flexBasis: { xs: "40%", md: "auto" },
    maxWidth: { xs: "49%", md: CARD_WIDTH },
    padding: theme.spacing[1],
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: "transparent",
    gap: theme.spacing[2],
  },
  cardSelected: {
    borderColor: theme.colors.accent,
  },
  thumbFrame: {
    height: THUMB_HEIGHT,
    borderRadius: theme.borderRadius.md,
    borderWidth: theme.borderWidth[1],
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing[1],
    paddingHorizontal: theme.spacing[1],
    paddingBottom: theme.spacing[1],
  },
  label: {
    flexShrink: 1,
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
  },
  labelSelected: {
    color: theme.colors.foreground,
  },
  // Thumbnail geometry — colors come from the previewed theme, not the active one.
  thumbRoot: {
    flex: 1,
    flexDirection: "row",
  },
  thumbSidebar: {
    width: 36,
    paddingTop: 8,
    paddingHorizontal: 4,
    gap: 4,
    borderRightWidth: 1,
  },
  thumbSidebarItem: {
    height: 9,
    borderRadius: 2,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  thumbSidebarLine: {
    height: 3,
    borderRadius: 1.5,
    width: "100%",
    opacity: 0.8,
  },
  thumbShort: {
    width: "60%",
  },
  thumbMain: {
    flex: 1,
    paddingTop: 9,
    paddingHorizontal: 8,
    gap: 5,
  },
  thumbTitle: {
    height: 4,
    width: "70%",
    borderRadius: 2,
  },
  thumbBody: {
    height: 3,
    width: "90%",
    borderRadius: 1.5,
    opacity: 0.7,
  },
  thumbInput: {
    marginTop: "auto",
    marginBottom: 7,
    height: 13,
    borderRadius: 3,
    borderWidth: 1,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  thumbAccent: {
    width: 14,
    height: 6,
    borderRadius: 2,
  },
  autoRoot: {
    flex: 1,
    flexDirection: "row",
  },
  autoHalf: {
    flex: 1,
    overflow: "hidden",
  },
  autoHalfRight: {
    alignItems: "flex-end",
  },
  // Each half crops a full-width thumbnail (light from the left, dark from the
  // right), so the two read as one window split down the middle.
  autoShift: {
    width: "200%",
    height: "100%",
  },
}));
