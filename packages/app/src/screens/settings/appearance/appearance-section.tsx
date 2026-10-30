import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import {
  SYNTAX_THEME_OPTIONS,
  type SyntaxThemeId,
  type SyntaxThemeOption,
} from "@getpaseo/highlight";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { DropdownTrigger } from "@/components/ui/dropdown-trigger";
import { SettingsSection } from "@/components/settings/headings/settings-section";
import { useContributedThemes } from "@/appearance/provider";
import { Button } from "@/components/ui/button";
import {
  EditingTextInput as TextInput,
  type EditingTextInputHandle,
} from "@/components/ui/text-input";
import {
  MAX_CODE_FONT_SIZE,
  MAX_CONTENT_FONT_SIZE,
  MAX_UI_BASE_FONT_SIZE,
  MIN_CODE_FONT_SIZE,
  MIN_CONTENT_FONT_SIZE,
  MIN_UI_BASE_FONT_SIZE,
  parseContentMaxWidth,
  resolveContentMaxWidth,
  sanitizeFontFamily,
  useAppSettings,
  type AppSettings,
  DEFAULT_THEME_PREFERENCE,
} from "@/hooks/use-settings";
import { PLUGIN_THEME_PREFERENCE } from "@/styles/theme";
import { isNative } from "@/constants/platform";
import type { PluginThemeOption } from "@/plugins/themes";
import { settingsStyles } from "@/styles/settings";
import { Minus, Plus } from "lucide-react-native";
import { inlineUnistylesStyle } from "@/styles/unistyles-inline-style";
import { AppearancePreview } from "./appearance-preview";
import {
  MONO_FONT_OPTIONS,
  UI_FONT_OPTIONS,
  customFontLabel,
  fontOptionFor,
  resolveFontOptions,
  type FontOption,
} from "./font-options";
import { ThemePicker, type BuiltInThemePreference } from "./theme-picker";

// ---------------------------------------------------------------------------
// Fonts: a picker of installed faces and −/+ size steppers (commit immediately)
// ---------------------------------------------------------------------------

interface FontMenuItemProps {
  option: FontOption;
  selected: boolean;
  onSelect: (stack: string) => void;
}

function FontMenuItem({ option, selected, onSelect }: FontMenuItemProps) {
  const handleSelect = useCallback(() => onSelect(option.stack), [onSelect, option.stack]);
  // Each option previews itself: "Aa" set in that face.
  const sampleStyle = useMemo(
    () => [styles.fontSample, inlineUnistylesStyle({ fontFamily: option.stack || undefined })],
    [option.stack],
  );
  const leading = useMemo(() => <Text style={sampleStyle}>Aa</Text>, [sampleStyle]);
  return (
    <DropdownMenuItem selected={selected} onSelect={handleSelect} leading={leading}>
      {option.label}
    </DropdownMenuItem>
  );
}

interface FontFamilyRowProps {
  title: string;
  hint: string;
  accessibilityLabel: string;
  options: readonly FontOption[];
  value: string;
  withBorder: boolean;
  onChange: (stack: string) => void;
}

function FontFamilyRow({
  title,
  hint,
  accessibilityLabel,
  options,
  value,
  withBorder,
  onChange,
}: FontFamilyRowProps) {
  const available = useMemo(() => resolveFontOptions(options, value), [options, value]);
  const selected = fontOptionFor(available, value);
  const selectedLabel = selected?.label ?? customFontLabel(value);
  return (
    <View style={withBorder ? styles.rowWithBorder : settingsStyles.row}>
      <View style={settingsStyles.rowContent}>
        <Text style={settingsStyles.rowTitle}>{title}</Text>
        <Text style={settingsStyles.rowHint}>{hint}</Text>
      </View>
      <DropdownMenu>
        <DropdownTrigger accessibilityLabel={`${accessibilityLabel}: ${selectedLabel}`}>
          {selectedLabel}
        </DropdownTrigger>
        <DropdownMenuContent side="bottom" align="end" width={240} scrollable>
          {available.map((option) => (
            <FontMenuItem
              key={option.stack || "default"}
              option={option}
              selected={option.stack === value.trim()}
              onSelect={onChange}
            />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </View>
  );
}

interface FontSizeRowProps {
  title: string;
  hint: string;
  accessibilityLabel: string;
  value: number;
  min: number;
  max: number;
  withBorder?: boolean;
  onChange: (value: number) => void;
}

function FontSizeRow({
  title,
  hint,
  accessibilityLabel,
  value,
  min,
  max,
  withBorder = true,
  onChange,
}: FontSizeRowProps) {
  const decrease = useCallback(() => onChange(Math.max(min, value - 1)), [min, onChange, value]);
  const increase = useCallback(() => onChange(Math.min(max, value + 1)), [max, onChange, value]);
  return (
    <View style={withBorder ? styles.rowWithBorder : settingsStyles.row}>
      <View style={settingsStyles.rowContent}>
        <Text style={settingsStyles.rowTitle}>{title}</Text>
        <Text style={settingsStyles.rowHint}>{hint}</Text>
      </View>
      <View style={styles.stepper} accessibilityLabel={`${accessibilityLabel}: ${value}px`}>
        <Button
          variant="outline"
          size="sm"
          onPress={decrease}
          disabled={value <= min}
          accessibilityLabel={`${title} −1`}
          leftIcon={Minus}
        />
        <Text style={styles.stepperValue}>{value}px</Text>
        <Button
          variant="outline"
          size="sm"
          onPress={increase}
          disabled={value >= max}
          accessibilityLabel={`${title} +1`}
          leftIcon={Plus}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Content width: numeric field (commit on blur/submit) + reset to the default
// ---------------------------------------------------------------------------

interface ContentWidthRowProps {
  value: AppSettings["contentMaxWidth"];
  onChange: (value: AppSettings["contentMaxWidth"]) => void;
}

function ContentWidthRow({ value, onChange }: ContentWidthRowProps) {
  const { t } = useTranslation();
  const width = resolveContentMaxWidth({ contentMaxWidth: value });
  // The field is uncontrolled, so a saved or reset width is written into it directly.
  const input = useRef<EditingTextInputHandle>(null);

  useEffect(() => {
    input.current?.replaceText(String(width));
  }, [width]);

  const commit = useCallback(() => {
    const next = parseContentMaxWidth(input.current?.getText()) ?? width;
    input.current?.replaceText(String(next));
    // Typing the width already in effect keeps following the default.
    if (next !== width) {
      onChange(next);
    }
  }, [onChange, width]);

  const reset = useCallback(() => {
    onChange(null);
  }, [onChange]);

  return (
    <View style={settingsStyles.row}>
      <View style={settingsStyles.rowContent}>
        <Text style={settingsStyles.rowTitle}>{t("settings.appearance.layout.contentWidth")}</Text>
        <Text style={settingsStyles.rowHint}>
          {t("settings.appearance.layout.contentWidthHint")}
        </Text>
      </View>
      <View style={styles.sizeField}>
        {value === null ? null : (
          <Button
            variant="ghost"
            size="sm"
            onPress={reset}
            accessibilityLabel={t("settings.appearance.layout.resetAccessibility")}
          >
            {t("settings.appearance.layout.reset")}
          </Button>
        )}
        <TextInput
          ref={input}
          initialValue={String(width)}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="number-pad"
          inputMode="numeric"
          selectTextOnFocus
          style={styles.widthInput}
          accessibilityLabel={t("settings.appearance.layout.contentWidthAccessibility")}
        />
        <Text style={styles.unit}>px</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Syntax highlight theme picker (commits immediately)
// ---------------------------------------------------------------------------

function syntaxLabelForId(id: SyntaxThemeId): string {
  const option = SYNTAX_THEME_OPTIONS.find((entry) => entry.id === id);
  return option ? option.label : id;
}

interface SyntaxMenuItemProps {
  option: SyntaxThemeOption;
  selected: boolean;
  onChange: (id: SyntaxThemeId) => void;
}

function SyntaxMenuItem({ option, selected, onChange }: SyntaxMenuItemProps) {
  const handleSelect = useCallback(() => {
    onChange(option.id);
  }, [onChange, option.id]);
  return (
    <DropdownMenuItem selected={selected} onSelect={handleSelect}>
      {option.label}
    </DropdownMenuItem>
  );
}

interface SyntaxRowProps {
  value: SyntaxThemeId;
  onChange: (id: SyntaxThemeId) => void;
}

function SyntaxRow({ value, onChange }: SyntaxRowProps) {
  const { t } = useTranslation();
  const selectedLabel = syntaxLabelForId(value);
  return (
    <View style={settingsStyles.row}>
      <View style={settingsStyles.rowContent}>
        <Text style={settingsStyles.rowTitle}>
          {t("settings.appearance.syntax.highlightTheme")}
        </Text>
        <Text style={settingsStyles.rowHint}>
          {t("settings.appearance.syntax.highlightThemeHint")}
        </Text>
      </View>
      <DropdownMenu>
        <DropdownTrigger
          accessibilityLabel={t("settings.appearance.syntax.highlightThemeAccessibility", {
            value: selectedLabel,
          })}
        >
          {selectedLabel}
        </DropdownTrigger>
        <DropdownMenuContent side="bottom" align="end" width={200}>
          {SYNTAX_THEME_OPTIONS.map((option) => (
            <SyntaxMenuItem
              key={option.id}
              option={option}
              selected={value === option.id}
              onChange={onChange}
            />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function AppearanceSection() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useAppSettings();
  const {
    options: pluginThemes,
    selected: selectedPluginTheme,
    select: selectPluginTheme,
  } = useContributedThemes();
  const showInterfaceFontFamilyRow = !isNative;

  // A selected contribution that is no longer installed shows the fallback the app renders.
  const builtInThemeValue =
    settings.theme === PLUGIN_THEME_PREFERENCE ? DEFAULT_THEME_PREFERENCE : settings.theme;

  const handleThemeChange = useCallback(
    (theme: BuiltInThemePreference) => {
      void updateSettings({ theme });
    },
    [updateSettings],
  );

  const handlePluginThemeChange = useCallback(
    (option: PluginThemeOption) => {
      selectPluginTheme(option);
    },
    [selectPluginTheme],
  );

  const handleContentMaxWidthChange = useCallback(
    (contentMaxWidth: AppSettings["contentMaxWidth"]) => {
      void updateSettings({ contentMaxWidth });
    },
    [updateSettings],
  );

  const handleSyntaxThemeChange = useCallback(
    (syntaxTheme: SyntaxThemeId) => {
      void updateSettings({ syntaxTheme });
    },
    [updateSettings],
  );

  const changeUiFontFamily = useCallback(
    (value: string) => {
      const sanitized = sanitizeFontFamily(value);
      if (sanitized !== null && sanitized !== settings.uiFontFamily) {
        void updateSettings({ uiFontFamily: sanitized });
      }
    },
    [settings.uiFontFamily, updateSettings],
  );

  const changeMonoFontFamily = useCallback(
    (value: string) => {
      const sanitized = sanitizeFontFamily(value);
      if (sanitized !== null && sanitized !== settings.monoFontFamily) {
        void updateSettings({ monoFontFamily: sanitized });
      }
    },
    [settings.monoFontFamily, updateSettings],
  );

  const changeUiBaseSize = useCallback(
    (uiBaseFontSize: number) => void updateSettings({ uiBaseFontSize }),
    [updateSettings],
  );
  const changeContentSize = useCallback(
    (contentFontSize: number) => void updateSettings({ contentFontSize }),
    [updateSettings],
  );
  const changeCodeSize = useCallback(
    (codeFontSize: number) => void updateSettings({ codeFontSize }),
    [updateSettings],
  );

  const previewOverrides = useMemo(
    () => ({
      contentFontSize: settings.contentFontSize,
      monoFontFamily: settings.monoFontFamily,
      codeFontSize: settings.codeFontSize,
    }),
    [settings.codeFontSize, settings.contentFontSize, settings.monoFontFamily],
  );

  return (
    <View>
      <SettingsSection title={t("settings.appearance.theme.title")}>
        <View style={settingsStyles.card}>
          <ThemePicker
            value={builtInThemeValue}
            pluginThemes={pluginThemes}
            selectedPluginTheme={selectedPluginTheme}
            onChange={handleThemeChange}
            onSelectPluginTheme={handlePluginThemeChange}
          />
        </View>
      </SettingsSection>
      <SettingsSection title={t("settings.appearance.fonts.title")}>
        <View style={settingsStyles.card}>
          {showInterfaceFontFamilyRow ? (
            <FontFamilyRow
              title={t("settings.appearance.fonts.interfaceFont")}
              hint={t("settings.appearance.fonts.interfaceFontHint")}
              accessibilityLabel={t("settings.appearance.fonts.interfaceFontAccessibility")}
              options={UI_FONT_OPTIONS}
              value={settings.uiFontFamily}
              withBorder={false}
              onChange={changeUiFontFamily}
            />
          ) : null}
          <FontSizeRow
            title={t("settings.appearance.fonts.interfaceSize")}
            hint={t("settings.appearance.fonts.interfaceSizeHint")}
            accessibilityLabel={t("settings.appearance.fonts.interfaceSizeAccessibility")}
            value={settings.uiBaseFontSize}
            min={MIN_UI_BASE_FONT_SIZE}
            max={MAX_UI_BASE_FONT_SIZE}
            withBorder={showInterfaceFontFamilyRow}
            onChange={changeUiBaseSize}
          />
          <FontSizeRow
            title={t("settings.appearance.fonts.contentSize")}
            hint={t("settings.appearance.fonts.contentSizeHint")}
            accessibilityLabel={t("settings.appearance.fonts.contentSizeAccessibility")}
            value={settings.contentFontSize}
            min={MIN_CONTENT_FONT_SIZE}
            max={MAX_CONTENT_FONT_SIZE}
            onChange={changeContentSize}
          />
          <FontFamilyRow
            title={t("settings.appearance.fonts.codeFont")}
            hint={t("settings.appearance.fonts.codeFontHint")}
            accessibilityLabel={t("settings.appearance.fonts.codeFontAccessibility")}
            options={MONO_FONT_OPTIONS}
            value={settings.monoFontFamily}
            withBorder
            onChange={changeMonoFontFamily}
          />
          <FontSizeRow
            title={t("settings.appearance.fonts.codeSize")}
            hint={t("settings.appearance.fonts.codeSizeHint")}
            accessibilityLabel={t("settings.appearance.fonts.codeSizeAccessibility")}
            value={settings.codeFontSize}
            min={MIN_CODE_FONT_SIZE}
            max={MAX_CODE_FONT_SIZE}
            onChange={changeCodeSize}
          />
        </View>
      </SettingsSection>
      <SettingsSection title={t("settings.appearance.layout.title")}>
        <View style={settingsStyles.card}>
          <ContentWidthRow
            value={settings.contentMaxWidth}
            onChange={handleContentMaxWidthChange}
          />
        </View>
      </SettingsSection>
      <SettingsSection title={t("settings.appearance.syntax.title")}>
        <View style={settingsStyles.card}>
          <SyntaxRow value={settings.syntaxTheme} onChange={handleSyntaxThemeChange} />
        </View>
        <View style={styles.preview}>
          <AppearancePreview overrides={previewOverrides} />
        </View>
      </SettingsSection>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  preview: {
    marginTop: theme.spacing[4],
  },
  rowWithBorder: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing[4],
    paddingHorizontal: theme.spacing[4],
    borderTopWidth: theme.borderWidth[1],
    borderTopColor: theme.colors.border,
  },
  fontFamilyInput: {
    flexGrow: 1,
    flexShrink: 1,
    maxWidth: 280,
    minHeight: 36,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    borderRadius: theme.borderRadius.md,
    borderWidth: theme.borderWidth[1],
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
    textAlign: "left",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
  },
  stepperValue: {
    minWidth: 44,
    textAlign: "center",
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
    fontVariant: ["tabular-nums"],
  },
  fontSample: {
    width: 22,
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
  },
  sizeField: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
  },
  sizeInput: {
    width: 64,
    minHeight: 36,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    borderRadius: theme.borderRadius.md,
    borderWidth: theme.borderWidth[1],
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
    textAlign: "right",
  },
  widthInput: {
    width: 80,
    minHeight: 36,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    borderRadius: theme.borderRadius.md,
    borderWidth: theme.borderWidth[1],
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
    textAlign: "right",
  },
  unit: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.base,
  },
  placeholderColor: {
    color: theme.colors.foregroundMuted,
  },
}));
