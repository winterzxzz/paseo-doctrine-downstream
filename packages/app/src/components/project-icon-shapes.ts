/**
 * The playful silhouettes a project gets when it has no icon of its own. Each is drawn in a
 * 24-unit box from a few same-colored primitives, so overlapping circles union cleanly and the
 * whole shape scales from the 16pt sidebar slot to the 40pt edit sheet without hinting tricks.
 *
 * Every shape keeps a solid body around its label point big enough for one white initial at 16pt
 * — the shape is the personality, the letter is still what tells two projects apart.
 *
 * Order is load-bearing: `deriveProjectIconShapeName` indexes into PROJECT_ICON_SHAPE_NAMES, so
 * reordering or inserting re-shapes every existing project. Append new shapes at the end.
 */
export const PROJECT_ICON_SHAPE_NAMES = [
  "blob",
  "cloud",
  "flower",
  "star",
  "ghost",
  "cat",
  "cookie",
  "drop",
  "heart",
  "bubble",
] as const;

export type ProjectIconShapeName = (typeof PROJECT_ICON_SHAPE_NAMES)[number];

export const PROJECT_ICON_VIEW_BOX = 24;

export type ProjectIconPrimitive =
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "rect"; x: number; y: number; width: number; height: number; rx: number }
  /** `rounded` strokes the path in its own fill color with round joins, softening corners. */
  | { kind: "path"; d: string; rounded?: boolean };

export interface ProjectIconShape {
  primitives: readonly ProjectIconPrimitive[];
  /** Vertical center of the shape's solid body, where the initial sits (view-box units). */
  labelCenterY: number;
}

function ring(count: number, radius: number, bumpRadius: number, phase: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = phase + (index * 2 * Math.PI) / count;
    return {
      kind: "circle" as const,
      cx: round(12 + radius * Math.cos(angle)),
      cy: round(12 + radius * Math.sin(angle)),
      r: bumpRadius,
    };
  });
}

function starPath(points: number, outer: number, inner: number, cx: number, cy: number): string {
  const vertices = Array.from({ length: points * 2 }, (_, index) => {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / points;
    return `${round(cx + radius * Math.cos(angle))} ${round(cy + radius * Math.sin(angle))}`;
  });
  return `M${vertices.join(" L")}Z`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

const SHAPES: Record<ProjectIconShapeName, ProjectIconShape> = {
  blob: {
    primitives: [
      {
        kind: "path",
        d: "M12 1.5c4.6 0 9.5 2.6 9.9 8 .4 5.6-3.4 12.5-9.6 12.5C6 22 1.7 17.6 2.1 11.6 2.5 5.4 7.3 1.5 12 1.5Z",
      },
    ],
    labelCenterY: 12,
  },
  cloud: {
    primitives: [
      { kind: "circle", cx: 7.5, cy: 14.5, r: 5.5 },
      { kind: "circle", cx: 13, cy: 10, r: 7 },
      { kind: "circle", cx: 17, cy: 15, r: 5 },
      { kind: "rect", x: 7.5, y: 12, width: 9.5, height: 8, rx: 0 },
    ],
    labelCenterY: 13,
  },
  flower: {
    primitives: [...ring(5, 6, 5, -Math.PI / 2), { kind: "circle", cx: 12, cy: 12, r: 6.5 }],
    labelCenterY: 12,
  },
  star: {
    primitives: [{ kind: "path", d: starPath(5, 10, 5.8, 12, 12.8), rounded: true }],
    labelCenterY: 13.3,
  },
  ghost: {
    primitives: [
      {
        kind: "path",
        d: "M4 11a8 8 0 0 1 16 0v10.5l-2.67-2-2.66 2-2.67-2-2.67 2-2.66-2L4 21.5Z",
        rounded: true,
      },
    ],
    labelCenterY: 12,
  },
  cat: {
    primitives: [
      { kind: "path", d: "M4 10 5 2.5 9.5 5.8Z", rounded: true },
      { kind: "path", d: "M20 10 19 2.5 14.5 5.8Z", rounded: true },
      { kind: "circle", cx: 12, cy: 13.5, r: 8.5 },
    ],
    labelCenterY: 14,
  },
  cookie: {
    primitives: [...ring(8, 8, 3.2, 0), { kind: "circle", cx: 12, cy: 12, r: 8.5 }],
    labelCenterY: 12,
  },
  drop: {
    primitives: [{ kind: "path", d: "M12 1.5C18 5.5 21 9.5 21 13.5a9 9 0 0 1-18 0c0-4 3-8 9-12Z" }],
    labelCenterY: 14,
  },
  heart: {
    primitives: [
      {
        kind: "path",
        d: "M12 21.5C5 17 1.5 13 1.5 8.5A5 5 0 0 1 12 6.2 5 5 0 0 1 22.5 8.5C22.5 13 19 17 12 21.5Z",
      },
    ],
    labelCenterY: 11.5,
  },
  bubble: {
    primitives: [
      { kind: "rect", x: 2, y: 2.5, width: 20, height: 15.5, rx: 6 },
      { kind: "path", d: "M7 16 6 21.5 13 17.5Z", rounded: true },
    ],
    labelCenterY: 10.25,
  },
};

export function projectIconShape(name: ProjectIconShapeName): ProjectIconShape {
  return SHAPES[name];
}

// FNV-1a, deliberately a different hash from the identity color's, so shape and color vary
// independently and two projects that share a color usually still differ in silhouette.
function hashShapeKey(key: string): number {
  let hash = 0x811c9dc5;
  for (const character of key) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function deriveProjectIconShapeName(key: string): ProjectIconShapeName {
  return PROJECT_ICON_SHAPE_NAMES[hashShapeKey(key) % PROJECT_ICON_SHAPE_NAMES.length];
}
