import { z } from "zod/v4";
import { normalizeHex } from "./colors";
import {
  COLOR_ROLES,
  type ColorRole,
  FONT_STYLES,
  type FontStyle,
  MAX_COLOR_NAME_LENGTH,
  MAX_COLORS,
  MAX_FONT_NAME_LENGTH,
  MAX_LOGOS,
  MAX_TONE_WORD_LENGTH,
  MAX_TONE_WORDS,
} from "./schema";

/**
 * What Claude returns for a brand document (spec §7.2). Logos are boxes on
 * the numbered images it was shown, as fractions of the image's width and
 * height; the browser crops them from its own copy of the image.
 */
export const BrandExtractionSchema = z.object({
  colors: z.array(
    z.object({
      hex: z.string(),
      role: z.enum(COLOR_ROLES),
      name: z.string().nullable(),
    }),
  ),
  fonts: z.array(
    z.object({
      name: z.string(),
      usage: z.enum(["heading", "body", "other"]),
      style: z.enum(FONT_STYLES),
    }),
  ),
  tone_words: z.array(z.string()),
  logos: z.array(
    z.object({
      image: z.number(),
      left: z.number(),
      top: z.number(),
      width: z.number(),
      height: z.number(),
      description: z.string().nullable(),
    }),
  ),
});

export type BrandExtraction = z.infer<typeof BrandExtractionSchema>;

export type LogoBox = { image: number; left: number; top: number; width: number; height: number; description: string | null };

/** A suggestion for the identity editor. Nothing is saved until the admin does so. */
export type BrandSuggestion = {
  colors: { hex: string; role: ColorRole; name: string | null }[];
  fonts: { heading: { name: string; style: FontStyle } | null; body: { name: string; style: FontStyle } | null };
  toneWords: string[];
  /** `image` is the 0-based index into the images the browser uploaded. */
  logos: LogoBox[];
};

const clean = (value: string | null | undefined, max: number) =>
  (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const FONT_NAME_CHARS = /[^\p{L}\p{N} .,&'+-]/gu;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));

/**
 * Tidies Claude's answer into a suggestion: valid hex colours only, no
 * duplicates, at most one main and one complementary colour, a heading and a
 * body font, short tone words, and logo boxes that lie on an image Claude was
 * actually shown (`image` is 1-based in the answer).
 */
export function toBrandSuggestion(extracted: BrandExtraction, imageCount: number): BrandSuggestion {
  const colors: BrandSuggestion["colors"] = [];
  for (const c of extracted.colors) {
    const hex = normalizeHex(c.hex);
    if (!hex || colors.some((x) => x.hex === hex) || colors.length >= MAX_COLORS) continue;
    const taken = colors.some((x) => x.role === c.role);
    colors.push({ hex, role: c.role !== "other" && taken ? "other" : c.role, name: clean(c.name, MAX_COLOR_NAME_LENGTH) || null });
  }
  // The first colour leads when Claude named no main colour.
  if (colors.length && !colors.some((c) => c.role === "primary")) {
    const first = colors.find((c) => c.role === "other") ?? colors[0];
    first.role = "primary";
  }

  const font = (usage: "heading" | "body") => {
    const f = extracted.fonts.find((x) => x.usage === usage && clean(x.name, MAX_FONT_NAME_LENGTH));
    if (!f) return null;
    const name = clean(f.name.replace(FONT_NAME_CHARS, ""), MAX_FONT_NAME_LENGTH);
    return name ? { name, style: f.style } : null;
  };
  const heading = font("heading");
  const body = font("body");

  const toneWords: string[] = [];
  for (const word of extracted.tone_words) {
    const w = clean(word, MAX_TONE_WORD_LENGTH);
    if (w && !toneWords.some((x) => x.toLowerCase() === w.toLowerCase()) && toneWords.length < MAX_TONE_WORDS) {
      toneWords.push(w);
    }
  }

  const logos: LogoBox[] = [];
  for (const l of extracted.logos) {
    const image = Math.round(l.image) - 1;
    if (image < 0 || image >= imageCount || logos.length >= MAX_LOGOS) continue;
    const left = clamp(l.left, 0, 1);
    const top = clamp(l.top, 0, 1);
    const width = clamp(l.width, 0, 1 - left);
    const height = clamp(l.height, 0, 1 - top);
    if (width < 0.01 || height < 0.01) continue;
    logos.push({ image, left, top, width, height, description: clean(l.description, 80) || null });
  }

  return { colors, fonts: { heading, body }, toneWords, logos };
}
