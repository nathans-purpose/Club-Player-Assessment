import { strFromU8, unzipSync, type Unzipped } from "fflate";
import { normalizeHex } from "./colors";

// Reads PowerPoint (.pptx) and Keynote (.key) files in the browser. Both are
// zip archives. From a .pptx we take the theme colours and fonts, the slide
// text and the embedded pictures; Keynote stores its text in a binary format,
// so from a .key we take the slide previews and the embedded pictures.

export class UnreadablePresentationError extends Error {}

export type EmbeddedImage = { name: string; bytes: Uint8Array; contentType: "image/png" | "image/jpeg" };

export type Presentation = {
  /** Theme colours as #RRGGBB with the slot they come from (accent1, dk2, …). */
  colors: { hex: string; slot: string }[];
  /** Theme fonts: major is used for headings, minor for body text. */
  fonts: { name: string; usage: "heading" | "body" }[];
  text: string;
  images: EmbeddedImage[];
};

const IMAGE_TYPES: Record<string, EmbeddedImage["contentType"]> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

const MAX_UNZIPPED_FILE = 25 * 1024 * 1024;

function unzip(bytes: Uint8Array, wanted: (name: string) => boolean): Unzipped {
  try {
    return unzipSync(bytes, { filter: (f) => wanted(f.name) && f.originalSize <= MAX_UNZIPPED_FILE });
  } catch {
    throw new UnreadablePresentationError("zip");
  }
}

function imageType(name: string): EmbeddedImage["contentType"] | null {
  return IMAGE_TYPES[name.toLowerCase().split(".").pop() ?? ""] ?? null;
}

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** Colour slots worth suggesting; lt1/dk1 are nearly always plain white and black. */
const COLOR_SLOTS = ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "dk2", "lt2"];

export function themeColors(themeXml: string): Presentation["colors"] {
  const colors: Presentation["colors"] = [];
  for (const slot of COLOR_SLOTS) {
    const match = themeXml.match(new RegExp(`<a:${slot}>\\s*<a:(?:srgbClr val|sysClr[^>]*lastClr)="([0-9A-Fa-f]{6})"`));
    const hex = match && normalizeHex(match[1]);
    if (hex && !colors.some((c) => c.hex === hex)) colors.push({ hex, slot });
  }
  return colors;
}

export function themeFonts(themeXml: string): Presentation["fonts"] {
  const fonts: Presentation["fonts"] = [];
  for (const [tag, usage] of [
    ["majorFont", "heading"],
    ["minorFont", "body"],
  ] as const) {
    const name = themeXml.match(new RegExp(`<a:${tag}>\\s*<a:latin typeface="([^"]+)"`))?.[1];
    if (name && !name.startsWith("+")) fonts.push({ name: decodeXml(name), usage });
  }
  return fonts;
}

/** The text runs of one slide, a line per paragraph. */
export function slideText(xml: string): string {
  return xml
    .split(/<\/a:p>/)
    .map((p) => [...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodeXml(m[1])).join(""))
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

const slideNumber = (name: string) => Number(name.match(/(\d+)\.xml$/)?.[1] ?? 0);

/** Pictures in the order they were added, PNGs first (logos usually have a transparent background). */
function pickImages(files: Unzipped, prefix: string, max: number, skip: (name: string) => boolean = () => false) {
  return Object.entries(files)
    .filter(([name]) => name.startsWith(prefix) && imageType(name) && !skip(name))
    .map(([name, bytes]) => ({ name, bytes, contentType: imageType(name)! }))
    .filter((img) => img.bytes.length > 0)
    .sort(
      (a, b) =>
        Number(b.contentType === "image/png") - Number(a.contentType === "image/png") ||
        a.name.localeCompare(b.name, "en", { numeric: true }),
    )
    .slice(0, max);
}

export function readPptx(bytes: Uint8Array, maxImages: number): Presentation {
  const files = unzip(
    bytes,
    (name) =>
      /^ppt\/theme\/theme\d+\.xml$/.test(name) ||
      /^ppt\/slides\/slide\d+\.xml$/.test(name) ||
      (name.startsWith("ppt/media/") && imageType(name) !== null),
  );
  const slides = Object.keys(files)
    .filter((n) => n.startsWith("ppt/slides/"))
    .sort((a, b) => slideNumber(a) - slideNumber(b));
  if (slides.length === 0) throw new UnreadablePresentationError("no slides");

  const theme = files["ppt/theme/theme1.xml"] ? strFromU8(files["ppt/theme/theme1.xml"]) : "";
  const text = slides
    .map((name) => slideText(strFromU8(files[name])))
    .filter(Boolean)
    .map((t, i) => `# Bild ${i + 1}\n${t}`)
    .join("\n\n");
  return { colors: themeColors(theme), fonts: themeFonts(theme), text, images: pickImages(files, "ppt/media/", maxImages) };
}

/**
 * A Keynote file: the first slide's preview, then pictures from Data/. The
 * small copies Keynote keeps of each picture ("-small-") are skipped.
 */
export function readKeynote(bytes: Uint8Array, maxImages: number): Presentation {
  const files = unzip(bytes, (name) => imageType(name) !== null && !name.includes("/._"));
  const preview = ["preview.jpg", "preview-web.jpg", "QuickLook/Thumbnail.jpg"].find((n) => files[n]);
  const images: EmbeddedImage[] = preview
    ? [{ name: preview, bytes: files[preview], contentType: "image/jpeg" }]
    : [];
  images.push(...pickImages(files, "Data/", maxImages - images.length, (n) => /-small-|^Data\/mt-/.test(n)));
  if (images.length === 0) throw new UnreadablePresentationError("no images");
  return { colors: [], fonts: [], text: "", images };
}
