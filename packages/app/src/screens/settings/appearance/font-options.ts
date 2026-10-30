import { isFontFamilyAvailable } from "./font-availability";

export interface FontOption {
  /** Shown in the picker. */
  label: string;
  /** The CSS font-family stack saved to settings; "" is the platform default. */
  stack: string;
  /** The face whose presence decides whether the option is offered; null = always. */
  probe: string | null;
}

export const DEFAULT_FONT_STACK = "";

export const UI_FONT_OPTIONS: FontOption[] = [
  { label: "System", stack: DEFAULT_FONT_STACK, probe: null },
  { label: "Inter", stack: "Inter, system-ui, sans-serif", probe: "Inter" },
  {
    label: "Helvetica Neue",
    stack: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    probe: "Helvetica Neue",
  },
  { label: "Avenir Next", stack: "'Avenir Next', Avenir, sans-serif", probe: "Avenir Next" },
  { label: "Segoe UI", stack: "'Segoe UI', system-ui, sans-serif", probe: "Segoe UI" },
  { label: "Roboto", stack: "Roboto, system-ui, sans-serif", probe: "Roboto" },
  {
    label: "IBM Plex Sans",
    stack: "'IBM Plex Sans', system-ui, sans-serif",
    probe: "IBM Plex Sans",
  },
  { label: "Verdana", stack: "Verdana, Geneva, sans-serif", probe: "Verdana" },
  { label: "Georgia (serif)", stack: "Georgia, 'Times New Roman', serif", probe: "Georgia" },
  {
    label: "Charter (serif)",
    stack: "Charter, 'Bitstream Charter', Georgia, serif",
    probe: "Charter",
  },
  {
    label: "Menlo (mono)",
    stack: "Menlo, 'SF Mono', Consolas, monospace",
    probe: "Menlo",
  },
];

export const MONO_FONT_OPTIONS: FontOption[] = [
  { label: "System", stack: DEFAULT_FONT_STACK, probe: null },
  { label: "SF Mono", stack: "'SF Mono', SFMono-Regular, Menlo, monospace", probe: "SF Mono" },
  { label: "Menlo", stack: "Menlo, monospace", probe: "Menlo" },
  { label: "Monaco", stack: "Monaco, monospace", probe: "Monaco" },
  { label: "JetBrains Mono", stack: "'JetBrains Mono', monospace", probe: "JetBrains Mono" },
  { label: "Fira Code", stack: "'Fira Code', monospace", probe: "Fira Code" },
  { label: "Cascadia Code", stack: "'Cascadia Code', monospace", probe: "Cascadia Code" },
  { label: "Source Code Pro", stack: "'Source Code Pro', monospace", probe: "Source Code Pro" },
  { label: "IBM Plex Mono", stack: "'IBM Plex Mono', monospace", probe: "IBM Plex Mono" },
  { label: "Consolas", stack: "Consolas, monospace", probe: "Consolas" },
  { label: "Courier New", stack: "'Courier New', Courier, monospace", probe: "Courier New" },
];

/** The options this device can render, plus the saved value when it is not one of them. */
export function resolveFontOptions(options: readonly FontOption[], current: string): FontOption[] {
  const available = options.filter(
    (option) => option.probe === null || isFontFamilyAvailable(option.probe),
  );
  const normalized = current.trim();
  if (normalized.length > 0 && !options.some((option) => option.stack === normalized)) {
    available.push({ label: customFontLabel(normalized), stack: normalized, probe: null });
  }
  return available;
}

/** "'Iosevka Term', monospace" → "Iosevka Term". */
export function customFontLabel(stack: string): string {
  const first = stack
    .split(",")[0]
    ?.trim()
    .replace(/^['"]|['"]$/g, "");
  return first && first.length > 0 ? first : stack;
}

export function fontOptionFor(options: readonly FontOption[], stack: string): FontOption | null {
  return options.find((option) => option.stack === stack.trim()) ?? null;
}
