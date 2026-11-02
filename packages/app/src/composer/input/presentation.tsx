import { useCallback, useMemo, type ReactNode, type Ref } from "react";
import { View, type ViewProps } from "react-native";
import { Maximize2, Minimize2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ComposerFullscreenBody, ComposerFullscreenFooter } from "@/composer/dock";
import { useComposerKeyboardScope } from "@/composer/keyboard-scope";
import { isWeb } from "@/constants/platform";
import { ICON_SIZE } from "@/styles/theme";
import { StyleSheet } from "react-native-unistyles";
import { useComposerFullscreenExit } from "./fullscreen-exit";
import { resolveGlyphRailOffset } from "./state";

const CONTROL_SIZE = 28;
const FULLSCREEN_GLYPH_SIZE = ICON_SIZE.md;

function keepEditorFocused(event: import("react-native").PointerEvent) {
  if (isWeb) event.preventDefault();
}

/**
 * One tree for both layout modes. The editing surface keeps its position so the
 * mounted editor, its native buffer, selection, and focus survive every toggle;
 * only the chrome around it changes. Fullscreen shows exit top right and Send
 * bottom right, both on the rail the inline Send button uses; a send error sits
 * in the same footer as Send.
 *
 * Inline, the editor sits in one row between the leading (attach) and trailing
 * (voice, send) controls, and the agent controls render under the box. The row
 * stays mounted in fullscreen with its side slots empty, so the editor keeps its
 * position in the tree.
 */
export function ComposerInputPresentation({
  fullscreen,
  sendIconSize,
  surface,
  leading,
  trailing,
  controls,
  send,
  error,
  onExit,
  inputWrapperRef,
  inputWrapperStyle,
  inputPointerEvents,
  attachmentSlot,
  showFullscreenButton,
  onEnter,
  overlay,
}: {
  fullscreen: boolean;
  sendIconSize: number;
  surface: ReactNode;
  leading: ReactNode;
  trailing: ReactNode;
  controls: ReactNode;
  send: ReactNode;
  error: ReactNode;
  onExit: () => void;
  inputWrapperRef: Ref<View>;
  inputWrapperStyle: ViewProps["style"];
  inputPointerEvents: ViewProps["pointerEvents"];
  attachmentSlot: ReactNode;
  showFullscreenButton: boolean;
  onEnter: () => void;
  overlay: ReactNode;
}) {
  const { t } = useTranslation();
  // A retained tab keeps its fullscreen editor mounted while hidden; the global exit
  // action (Escape, hardware back) belongs only to the pane the user is in.
  const { isActiveComposer } = useComposerKeyboardScope();
  const exitScopeRef = useComposerFullscreenExit(fullscreen && isActiveComposer, onExit);
  const railOffset = resolveGlyphRailOffset({
    controlSize: CONTROL_SIZE,
    sendIconSize,
    glyphIconSize: FULLSCREEN_GLYPH_SIZE,
  });
  const maximizeIcon = useCallback(
    (color: string) => <Maximize2 color={color} size={FULLSCREEN_GLYPH_SIZE} />,
    [],
  );
  const minimizeIcon = useCallback(
    (color: string) => <Minimize2 color={color} size={FULLSCREEN_GLYPH_SIZE} />,
    [],
  );
  // The inline glyph sits on the text column's right edge, next to the trailing controls.
  const enterStyle = useMemo(() => [styles.enterButton, { right: railOffset }], [railOffset]);
  const exitStyle = useMemo(() => [styles.iconButton, { marginRight: railOffset }], [railOffset]);
  return (
    <View
      ref={exitScopeRef}
      style={fullscreen ? styles.fullscreen : styles.inline}
      testID={fullscreen ? "composer-fullscreen" : undefined}
    >
      {fullscreen ? (
        <View style={styles.exitRow}>
          <Button
            variant="ghost"
            size="xs"
            accessibilityLabel={t("composer.input.exitFullscreen")}
            onPointerDown={keepEditorFocused}
            onPress={onExit}
            style={exitStyle}
            leftIcon={minimizeIcon}
            hitSlop={8}
          >
            {null}
          </Button>
        </View>
      ) : null}
      <ComposerFullscreenBody fullscreen={fullscreen}>
        <View
          ref={inputWrapperRef}
          style={fullscreen ? styles.fullscreenInputWrapper : inputWrapperStyle}
          pointerEvents={inputPointerEvents}
        >
          {fullscreen ? null : attachmentSlot}
          <View style={fullscreen ? styles.fullscreenRow : styles.inputRow}>
            {fullscreen ? null : leading}
            <View style={fullscreen ? styles.fullscreenTextSurface : styles.inlineTextSurface}>
              {surface}
              {showFullscreenButton && !fullscreen ? (
                <Button
                  variant="ghost"
                  size="xs"
                  accessibilityLabel={t("composer.input.fullscreen")}
                  leftIcon={maximizeIcon}
                  onPointerDown={keepEditorFocused}
                  onPress={onEnter}
                  style={enterStyle}
                  hitSlop={8}
                >
                  {null}
                </Button>
              ) : null}
            </View>
            {fullscreen ? null : trailing}
          </View>
        </View>
        {fullscreen ? null : controls}
      </ComposerFullscreenBody>
      {fullscreen ? (
        <ComposerFullscreenFooter style={styles.footer}>
          {error}
          <View style={styles.sendRow}>{send}</View>
        </ComposerFullscreenFooter>
      ) : null}
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  inline: { flexShrink: 1, position: "relative" },
  // Buttons hold the bottom edge so a multi-line draft grows upward past them.
  inputRow: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: theme.spacing[2],
  },
  fullscreenRow: { flex: 1, minHeight: 0 },
  // The text sits between 32px buttons: the padding centers one line on them.
  inlineTextSurface: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    position: "relative",
    paddingVertical: isWeb ? 5 : 1,
  },
  iconButton: {
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
    padding: 0,
    borderWidth: 0,
    borderRadius: theme.borderRadius.full,
  },
  enterButton: {
    position: "absolute",
    top: 0,
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
    padding: 0,
    borderWidth: 0,
    borderRadius: theme.borderRadius.full,
  },
  fullscreen: {
    flex: 1,
    backgroundColor: theme.colors.surface1,
    padding: theme.spacing[4],
    gap: theme.spacing[3],
  },
  fullscreenInputWrapper: { flex: 1, minHeight: 0 },
  fullscreenTextSurface: { flex: 1, minHeight: 0 },
  exitRow: { alignItems: "flex-end", flexShrink: 0 },
  // The send error rides the keyboard with Send; below the body it would sit behind it.
  footer: { flexShrink: 0, gap: theme.spacing[3] },
  sendRow: { alignItems: "flex-end" },
}));
