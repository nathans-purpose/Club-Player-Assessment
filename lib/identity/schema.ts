import { z } from "zod/v4";
import { HEX_PATTERN } from "./colors";

// The shape of a club's visual identity as stored in `club_identity`
// (colors, fonts, logos and tone_words). Admins can write the row directly
// through the API, so everything read back is checked again here before it
// reaches a page or a stylesheet.

export const COLOR_ROLES = ["primary", "secondary", "other"] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];

/** How a font looks, which decides the bundled fallback until a file is uploaded. */
export const FONT_STYLES = ["sans", "serif", "condensed", "extended"] as const;
export type FontStyle = (typeof FONT_STYLES)[number];

export const FONT_SLOTS = ["heading", "body"] as const;
export type FontSlot = (typeof FONT_SLOTS)[number];

export const MAX_COLORS = 8;
export const MAX_LOGOS = 6;
export const MAX_TONE_WORDS = 8;
export const MAX_TONE_WORD_LENGTH = 30;
export const MAX_FONT_NAME_LENGTH = 60;
export const MAX_COLOR_NAME_LENGTH = 40;

/** Letters (Swedish too), digits, spaces and a few separators; nothing that could end a CSS string. */
const FONT_NAME_PATTERN = /^[\p{L}\p{N} .,&'+-]+$/u;
const ASSET_ID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const LOGO_PATH_PATTERN = new RegExp(`^(${ASSET_ID})/logos/${ASSET_ID}\\.png$`);
export const FONT_PATH_PATTERN = new RegExp(`^(${ASSET_ID})/fonts/${ASSET_ID}\\.(woff2|woff|otf|ttf)$`);

const ColorSchema = z.object({
  hex: z.string().regex(HEX_PATTERN),
  role: z.enum(COLOR_ROLES),
  name: z.string().trim().max(MAX_COLOR_NAME_LENGTH).nullable(),
});

const FontSchema = z.object({
  name: z.string().trim().min(1).max(MAX_FONT_NAME_LENGTH).regex(FONT_NAME_PATTERN),
  style: z.enum(FONT_STYLES),
  /** Storage path in the club-assets bucket of an uploaded font file, or null. */
  file: z.string().regex(FONT_PATH_PATTERN).nullable(),
});

const LogoSchema = z.object({
  /** Storage path in the club-assets bucket: <clubId>/logos/<id>.png */
  path: z.string().regex(LOGO_PATH_PATTERN),
  description: z.string().trim().max(80).nullable(),
});

export const IdentitySchema = z
  .object({
    colors: z.array(ColorSchema).max(MAX_COLORS),
    fonts: z.object({ heading: FontSchema.nullable(), body: FontSchema.nullable() }),
    logos: z.array(LogoSchema).max(MAX_LOGOS),
    toneWords: z.array(z.string().trim().min(1).max(MAX_TONE_WORD_LENGTH)).max(MAX_TONE_WORDS),
  })
  .refine((v) => v.colors.filter((c) => c.role === "primary").length <= 1, "At most one primary colour")
  .refine((v) => v.colors.filter((c) => c.role === "secondary").length <= 1, "At most one secondary colour");

export type Identity = z.infer<typeof IdentitySchema>;
export type IdentityColor = Identity["colors"][number];
export type IdentityFont = NonNullable<Identity["fonts"]["heading"]>;
export type IdentityLogo = Identity["logos"][number];

export const EMPTY_IDENTITY: Identity = { colors: [], fonts: { heading: null, body: null }, logos: [], toneWords: [] };

/** The club_identity columns as stored. */
export type IdentityRow = {
  colors: unknown;
  fonts: unknown;
  logos: unknown;
  tone_words: unknown;
  is_applied: boolean;
};

export function toRow(identity: Identity): Omit<IdentityRow, "is_applied"> {
  return {
    colors: { palette: identity.colors },
    fonts: identity.fonts,
    logos: { items: identity.logos },
    tone_words: identity.toneWords,
  };
}

/**
 * Reads a stored row back. Anything that does not match the schema (a row
 * written by hand, or by an older version) gives the default identity rather
 * than half a theme. Assets must sit in this club's own folder.
 */
export function fromRow(row: IdentityRow | null, clubId: string): Identity | null {
  if (!row) return null;
  const colors = row.colors as { palette?: unknown } | null;
  const logos = row.logos as { items?: unknown } | null;
  const fonts = row.fonts as { heading?: unknown; body?: unknown } | null;
  const parsed = IdentitySchema.safeParse({
    colors: colors?.palette ?? [],
    fonts: { heading: fonts?.heading ?? null, body: fonts?.body ?? null },
    logos: logos?.items ?? [],
    toneWords: row.tone_words ?? [],
  });
  if (!parsed.success || !assetsBelongTo(parsed.data, clubId)) return null;
  return parsed.data;
}

/** True when every logo and font file sits under `<clubId>/`. */
export function assetsBelongTo(identity: Identity, clubId: string): boolean {
  const own = (path: string) => path.split("/")[0] === clubId.toLowerCase();
  return (
    identity.logos.every((l) => own(l.path)) &&
    FONT_SLOTS.every((slot) => !identity.fonts[slot]?.file || own(identity.fonts[slot]!.file!))
  );
}

export function primaryColor(identity: Identity): string | null {
  return identity.colors.find((c) => c.role === "primary")?.hex ?? null;
}

export function secondaryColor(identity: Identity): string | null {
  return identity.colors.find((c) => c.role === "secondary")?.hex ?? null;
}
