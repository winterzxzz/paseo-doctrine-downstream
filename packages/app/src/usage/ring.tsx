import { useCallback } from "react";
import Svg, { Circle } from "react-native-svg";
import { withUnistyles } from "react-native-unistyles";
import type { Theme } from "@/styles/theme";
import { clampPct } from "./format";
import { usagePeriodColor, type UsagePeriod } from "./period";
import type { UsageTone } from "./types";

// Wrap the whole SVG: withUnistyles adds a div on web, which cannot sit inside an SVG.
const Ring = withUnistyles(function Ring({
  size,
  strokeWidth,
  percent,
  trackColor,
  progressColor,
}: {
  size: number;
  strokeWidth: number;
  percent: number;
  trackColor: string;
  progressColor: string;
}) {
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = clampPct(percent);
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
      {filled > 0 ? (
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (filled / 100) * circumference}
          // SVG strokes start at three o'clock; the ring reads clockwise from twelve.
          transform={`rotate(-90 ${center} ${center})`}
        />
      ) : null}
    </Svg>
  );
});

/** A window's share as a ring, coloured by its period (5h, week, month). */
export function UsageRing({
  percent,
  period,
  tone,
  size = 14,
  strokeWidth = 2.25,
}: {
  percent: number;
  period: UsagePeriod;
  tone: UsageTone;
  size?: number;
  strokeWidth?: number;
}) {
  const colors = useCallback(
    (theme: Theme) => ({
      progressColor: usagePeriodColor(period, tone, theme),
      trackColor: theme.colors.surface3,
    }),
    [period, tone],
  );
  return <Ring size={size} strokeWidth={strokeWidth} percent={percent} uniProps={colors} />;
}
