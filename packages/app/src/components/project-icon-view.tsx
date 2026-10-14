import { useMemo } from "react";
import { type StyleProp, StyleSheet, Text, type TextStyle, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { ProjectIconImage } from "@/components/project-icon-image";
import {
  deriveProjectIconShapeName,
  PROJECT_ICON_VIEW_BOX,
  type ProjectIconPrimitive,
  projectIconShape,
} from "@/components/project-icon-shapes";
import { deriveIdentityColorName, identityColor } from "@/styles/identity-colors";

const WHITE_TEXT = { color: "#ffffff" } as const;
// Softens the corners of `rounded` shape paths (star points, ears, tails) at every size.
const ROUNDED_STROKE_WIDTH = 2.4;

/**
 * Corner radius of a square project-icon placeholder (the loading skeleton) as a fraction of
 * the box, so it reads as the same shape at every size. Generated icons are silhouettes now —
 * see project-icon-shapes.ts.
 * A **user-uploaded icon is never rounded** — it is someone's mark, and
 * clipping its corners distorts branding we don't own. A square logo stays square, a round one is
 * already round.
 */
const RADIUS_RATIO = 0.25;

export function projectIconRadius(size: number): number {
  return Math.round(size * RADIUS_RATIO);
}

/**
 * A project's icon: its chosen image, or a playful silhouette (blob, cloud, cat…) in the
 * project's identity color carrying its initial. Shape and color are both derived from the
 * project key, so a project keeps the same look across reloads and screens.
 *
 * Geometry lives here, not at the call site — pass a `size` and the shape follows.
 */
export function ProjectIconView({
  iconDataUri,
  initial,
  projectViewKey,
  size,
  textStyle,
}: {
  iconDataUri: string | null;
  initial: string;
  projectViewKey: string;
  size: number;
  textStyle: StyleProp<TextStyle>;
}) {
  // The uploaded image is sized but never clipped — see projectIconRadius.
  const box = useMemo(() => ({ width: size, height: size }), [size]);
  const fallback = useMemo(
    () => (
      <ProjectIconFallback
        initial={initial}
        projectViewKey={projectViewKey}
        size={size}
        box={box}
        textStyle={textStyle}
      />
    ),
    [initial, projectViewKey, size, box, textStyle],
  );

  return iconDataUri ? (
    <ProjectIconImage dataUri={iconDataUri} fallback={fallback} style={box} />
  ) : (
    fallback
  );
}

function ProjectIconFallback({
  initial,
  projectViewKey,
  size,
  box,
  textStyle,
}: {
  initial: string;
  projectViewKey: string;
  size: number;
  box: { width: number; height: number };
  textStyle: StyleProp<TextStyle>;
}) {
  const color = identityColor(deriveIdentityColorName(projectViewKey));
  const shape = projectIconShape(deriveProjectIconShapeName(projectViewKey));
  // Each silhouette's solid body sits at its own height (a cat's face is below its ears), so
  // the initial is nudged onto it rather than onto the geometric center of the box.
  const labelOffset = Math.round(
    ((shape.labelCenterY - PROJECT_ICON_VIEW_BOX / 2) / PROJECT_ICON_VIEW_BOX) * size,
  );
  const labelLayerStyle = useMemo(
    () => [styles.labelLayer, { transform: [{ translateY: labelOffset }] }],
    [labelOffset],
  );
  const textStyles = useMemo(() => [textStyle, WHITE_TEXT], [textStyle]);

  return (
    <View style={box}>
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${PROJECT_ICON_VIEW_BOX} ${PROJECT_ICON_VIEW_BOX}`}
      >
        {shape.primitives.map((primitive) => (
          <ShapePrimitive key={primitiveKey(primitive)} primitive={primitive} color={color} />
        ))}
      </Svg>
      <View style={labelLayerStyle} pointerEvents="none">
        <Text style={textStyles}>{initial}</Text>
      </View>
    </View>
  );
}

function primitiveKey(primitive: ProjectIconPrimitive): string {
  switch (primitive.kind) {
    case "circle":
      return `c${primitive.cx},${primitive.cy},${primitive.r}`;
    case "rect":
      return `r${primitive.x},${primitive.y},${primitive.width},${primitive.height}`;
    case "path":
      return `p${primitive.d}`;
  }
}

function ShapePrimitive({ primitive, color }: { primitive: ProjectIconPrimitive; color: string }) {
  switch (primitive.kind) {
    case "circle":
      return <Circle cx={primitive.cx} cy={primitive.cy} r={primitive.r} fill={color} />;
    case "rect":
      return (
        <Rect
          x={primitive.x}
          y={primitive.y}
          width={primitive.width}
          height={primitive.height}
          rx={primitive.rx}
          fill={color}
        />
      );
    case "path":
      return primitive.rounded ? (
        <Path
          d={primitive.d}
          fill={color}
          stroke={color}
          strokeWidth={ROUNDED_STROKE_WIDTH}
          strokeLinejoin="round"
        />
      ) : (
        <Path d={primitive.d} fill={color} />
      );
  }
}

const styles = StyleSheet.create({
  labelLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
