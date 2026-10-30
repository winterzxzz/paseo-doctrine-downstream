// A local font is installed when text set in it measures differently from every
// generic fallback. Measured once per face and cached for the session.
const FALLBACKS = ["monospace", "serif", "sans-serif"] as const;
const SAMPLE = "mmmmmmmmmmlli1WQ@#";
const cache = new Map<string, boolean>();
let context: CanvasRenderingContext2D | null | undefined;

function measureContext(): CanvasRenderingContext2D | null {
  if (context === undefined) {
    context =
      typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  }
  return context;
}

export function isFontFamilyAvailable(face: string): boolean {
  const cached = cache.get(face);
  if (cached !== undefined) return cached;
  const ctx = measureContext();
  if (!ctx) return true;
  const available = FALLBACKS.some((fallback) => {
    ctx.font = `72px ${fallback}`;
    const base = ctx.measureText(SAMPLE).width;
    ctx.font = `72px "${face}", ${fallback}`;
    return ctx.measureText(SAMPLE).width !== base;
  });
  cache.set(face, available);
  return available;
}
