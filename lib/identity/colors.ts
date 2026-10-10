// Colour helpers for a club's visual identity: parsing hex colours, WCAG
// contrast, and the darker text variant used when the club's main colour is
// too light to read on white (spec §7.2).

export const HEX_PATTERN = /^#[0-9A-F]{6}$/;

/** "#abc", "abc", "#AABBCC" → "#AABBCC"; null when it is not a hex colour. */
export function normalizeHex(value: string): string | null {
  const raw = value.trim().replace(/^#/, "").toUpperCase();
  if (/^[0-9A-F]{3}$/.test(raw)) return `#${[...raw].map((c) => c + c).join("")}`;
  if (/^[0-9A-F]{6}$/.test(raw)) return `#${raw}`;
  return null;
}

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Normal-size text needs 4.5:1 (WCAG AA). */
export const TEXT_CONTRAST = 4.5;

export const WHITE = "#FFFFFF";
/** Dark text used on light buttons; the theme's default foreground. */
export const DARK_TEXT = "#14171A";

function toHsl([r, g, b]: Rgb): [number, number, number] {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === rr ? ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6 : max === gg ? ((bb - rr) / d + 2) / 6 : ((rr - gg) / d + 4) / 6;
  return [h, s, l];
}

function fromHsl([h, s, l]: [number, number, number]): Rgb {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    const tt = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255];
}

/**
 * The colour itself when it reads as text on every given background (4.5:1),
 * otherwise the same hue made darker, step by step, until it does. Saturation
 * is eased a little on the way down so a bright blue turns into a calm darker
 * blue rather than a neon one (e.g. #509BF5 → about #2F6FCC).
 */
export function textVariant(hex: string, backgrounds: string[] = [WHITE]): string {
  const passes = (c: string) => backgrounds.every((bg) => contrastRatio(c, bg) >= TEXT_CONTRAST);
  if (passes(hex)) return hex;
  const [h, s, l] = toHsl(toRgb(hex));
  for (let step = 1; step <= 100; step++) {
    const lightness = l * (1 - step / 100);
    const saturation = s * (1 - Math.min(step, 40) / 100);
    const candidate = toHex(fromHsl([h, saturation, lightness]));
    if (passes(candidate)) return candidate;
  }
  return DARK_TEXT;
}

/** White text on the colour when that reads well enough, otherwise dark text. */
export function textOn(hex: string): string {
  if (contrastRatio(WHITE, hex) >= TEXT_CONTRAST) return WHITE;
  return contrastRatio(DARK_TEXT, hex) >= contrastRatio(WHITE, hex) ? DARK_TEXT : WHITE;
}

/** "4,52:1" — Swedish decimal comma, two decimals. */
export function formatRatio(ratio: number): string {
  return `${(Math.floor(ratio * 100) / 100).toFixed(2).replace(".", ",")}:1`;
}
