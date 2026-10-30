import { useCallback } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import type { Theme } from "@/styles/theme";
import { clampPct } from "./format";
import { usagePeriodColor, type UsagePeriod } from "./period";
import type { UsageTone } from "./types";

const Fill = withUnistyles(function Fill({ width, color }: { width: number; color: string }) {
  return <View style={[styles.fill, { width: `${width}%`, backgroundColor: color }]} />;
});

/**
 * A window's share as a bar, coloured by its period (5h, week, month) like the sidebar rings,
 * or by danger when it is nearly used up. The caller sizes the track.
 */
export function UsageMeter({
  percent,
  tone,
  period,
  style,
}: {
  percent: number;
  tone: UsageTone;
  period: UsagePeriod;
  style?: StyleProp<ViewStyle>;
}) {
  const fillColor = useCallback(
    (theme: Theme) => ({ color: usagePeriodColor(period, tone, theme) }),
    [period, tone],
  );
  return (
    <View style={[styles.track, style]}>
      <Fill width={clampPct(percent)} uniProps={fillColor} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.surface3,
    overflow: "hidden",
  },
  // Follows the track, so a caller that sizes the track sizes the bar.
  fill: {
    height: "100%",
    borderRadius: theme.borderRadius.full,
  },
}));
