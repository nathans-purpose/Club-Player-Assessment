import { textOn, textVariant, WHITE } from "./colors";
import { FONT_SLOTS, type FontSlot, type FontStyle, type Identity, primaryColor, secondaryColor } from "./schema";

// Turns a club's identity into theme tokens (the CSS variables in
// app/globals.css). Only the brand tokens change: the assessment colour scale
// (spec §5.9), the pitch and the page background stay the same for every club.

/** The surfaces text in the primary colour appears on (white cards and the page background). */
const TEXT_BACKGROUNDS = [WHITE, "#F6F7F5"];

/** Bundled fallbacks for licensed fonts that have not been uploaded (spec §7.2). */
export const FONT_FALLBACKS: Record<FontStyle, { family: string; stretch: string; label: string }> = {
  sans: { family: "var(--font-geist-sans), system-ui, sans-serif", stretch: "normal", label: "Geist" },
  serif: { family: 'Georgia, "Times New Roman", serif', stretch: "normal", label: "Georgia" },
  condensed: { family: "var(--font-archivo), system-ui, sans-serif", stretch: "75%", label: "Archivo Condensed" },
  extended: { family: "var(--font-archivo), system-ui, sans-serif", stretch: "125%", label: "Archivo Expanded" },
};

const FONT_FAMILY: Record<FontSlot, string> = { heading: "Club Heading", body: "Club Body" };
const FONT_FORMAT: Record<string, string> = { woff2: "woff2", woff: "woff", otf: "opentype", ttf: "truetype" };

export type Contrast = {
  primary: string;
  /** Text, links and focus rings in the primary colour. Differs from `primary` when that is too light. */
  ink: string;
  /** Text on buttons in the primary colour. */
  onPrimary: string;
  adjusted: boolean;
};

/** The contrast check for the primary colour (spec §7.2), or null when there is none. */
export function primaryContrast(identity: Identity): Contrast | null {
  const primary = primaryColor(identity);
  if (!primary) return null;
  const ink = textVariant(primary, TEXT_BACKGROUNDS);
  return { primary, ink, onPrimary: textOn(primary), adjusted: ink !== primary };
}

type FontSource = { slot: FontSlot; url: string; format: string };

/**
 * The theme tokens for an identity. `fontUrl` turns an uploaded font file's
 * storage path into a URL; a file with no usable URL falls back as if it had
 * not been uploaded.
 */
export function themeTokens(
  identity: Identity,
  fontUrl: (path: string) => string | null,
): { vars: Record<string, string>; fontFaces: FontSource[] } {
  const vars: Record<string, string> = {};
  const fontFaces: FontSource[] = [];

  const contrast = primaryContrast(identity);
  if (contrast) {
    vars["--primary"] = contrast.primary;
    vars["--primary-ink"] = contrast.ink;
    vars["--on-primary"] = contrast.onPrimary;
  }
  const stripe = secondaryColor(identity) ?? contrast?.primary;
  if (stripe) vars["--brand-stripe"] = stripe;

  for (const slot of FONT_SLOTS) {
    const font = identity.fonts[slot];
    if (!font) continue;
    const fallback = FONT_FALLBACKS[font.style];
    const url = font.file ? safeUrl(fontUrl(font.file)) : null;
    if (url) {
      const ext = font.file!.split(".").pop()!;
      fontFaces.push({ slot, url, format: FONT_FORMAT[ext] });
      vars[`--font-${slot}`] = `"${FONT_FAMILY[slot]}", ${fallback.family}`;
      vars[`--${slot}-stretch`] = "normal";
    } else {
      vars[`--font-${slot}`] = fallback.family;
      vars[`--${slot}-stretch`] = fallback.stretch;
    }
  }
  return { vars, fontFaces };
}

/** URLs go inside url("…") in a <style> element, so anything that could end it is refused. */
function safeUrl(url: string | null): string | null {
  if (!url || !/^https?:\/\/[^\s"'()<>\\]+$/.test(url)) return null;
  return url;
}

/** A stylesheet that applies the identity to the whole page. */
export function themeCss(identity: Identity, fontUrl: (path: string) => string | null): string {
  const { vars, fontFaces } = themeTokens(identity, fontUrl);
  const faces = fontFaces.map(
    (f) =>
      `@font-face{font-family:"${FONT_FAMILY[f.slot]}";src:url("${f.url}") format("${f.format}");font-display:swap}`,
  );
  const declarations = Object.entries(vars).map(([name, value]) => `${name}:${value}`);
  return [...faces, declarations.length ? `:root{${declarations.join(";")}}` : ""].join("\n");
}

/** Names shown to the admin: the club's font, or what is used until its file is uploaded. */
export function fontStatus(font: Identity["fonts"]["heading"]): { uploaded: boolean; fallback: string } | null {
  if (!font) return null;
  return { uploaded: Boolean(font.file), fallback: FONT_FALLBACKS[font.style].label };
}
