// Which files the brand document import and the identity page accept, and
// where they are stored. Shared by the browser and the server.

/** Private bucket for the prepared pages of a brand document while the server reads them. */
export const BRAND_IMPORT_BUCKET = "brand-imports";
/** Public bucket for a club's logos and font files, which every member's browser loads. */
export const ASSETS_BUCKET = "club-assets";

export const BRAND_DOCUMENT_MAX_BYTES = 50 * 1024 * 1024;
/** Each prepared page or image sent to Claude. */
export const BRAND_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const BRAND_IMAGE_MAX_SIDE = 1600;
/** Pages, slides and embedded images sent to Claude per document. */
export const BRAND_MAX_IMAGES = 8;
export const BRAND_MAX_HINT_CHARS = 20_000;

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const FONT_MAX_BYTES = 5 * 1024 * 1024;

export type BrandDocumentKind = "pdf" | "pptx" | "keynote" | "image";

const DOCUMENT_TYPES: Record<string, BrandDocumentKind> = {
  pdf: "pdf",
  pptx: "pptx",
  key: "keynote",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
};

const DOCUMENT_CONTENT_TYPES: Record<string, BrandDocumentKind> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/x-iwork-keynote-sffkey": "keynote",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
};

export const BRAND_DOCUMENT_ACCEPT = [...Object.keys(DOCUMENT_TYPES).map((e) => `.${e}`), "image/*"].join(",");

function extensionOf(name: string): string {
  return name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

/** How to read a brand document, from its name or content type. Null for files the import cannot read. */
export function brandDocumentKind(name: string, contentType = ""): BrandDocumentKind | null {
  return DOCUMENT_TYPES[extensionOf(name)] ?? DOCUMENT_CONTENT_TYPES[contentType.toLowerCase()] ?? null;
}

export const FONT_EXTENSIONS = ["woff2", "woff", "otf", "ttf"] as const;
export type FontExtension = (typeof FONT_EXTENSIONS)[number];
export const FONT_ACCEPT = FONT_EXTENSIONS.map((e) => `.${e}`).join(",");
export const FONT_CONTENT_TYPES: Record<FontExtension, string> = {
  woff2: "font/woff2",
  woff: "font/woff",
  otf: "font/otf",
  ttf: "font/ttf",
};

/** The extension of an uploadable font file, checked against the file's first bytes. */
export function fontExtension(name: string, head: Uint8Array): FontExtension | null {
  const ext = extensionOf(name) as FontExtension;
  if (!FONT_EXTENSIONS.includes(ext)) return null;
  const tag = String.fromCharCode(...head.slice(0, 4));
  const ok =
    ext === "woff2"
      ? tag === "wOF2"
      : ext === "woff"
        ? tag === "wOFF"
        : tag === "OTTO" || tag === "true" || (head[0] === 0 && head[1] === 1 && head[2] === 0 && head[3] === 0);
  return ok ? ext : null;
}

export const LOGO_ACCEPT = ".png,.jpg,.jpeg,.webp";

/** Storage path of a prepared page: `<clubId>/<batchId>/<n>.<png|jpg>`. */
export function brandImagePath(clubId: string, batchId: string, index: number, contentType: string): string {
  return `${clubId}/${batchId}/${index}.${contentType === "image/png" ? "png" : "jpg"}`;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const BRAND_IMAGE_PATTERN = new RegExp(`^(${UUID})/(${UUID})/(\\d)\\.(png|jpg)$`, "i");

/** Checks that a path was made by brandImagePath for this club and batch. */
export function parseBrandImagePath(
  clubId: string,
  batchId: string,
  path: string,
): { index: number; contentType: "image/png" | "image/jpeg" } | null {
  const match = path.match(BRAND_IMAGE_PATTERN);
  if (!match || match[1].toLowerCase() !== clubId.toLowerCase() || match[2].toLowerCase() !== batchId.toLowerCase()) {
    return null;
  }
  return { index: Number(match[3]), contentType: match[4].toLowerCase() === "png" ? "image/png" : "image/jpeg" };
}

export function logoPath(clubId: string, id: string): string {
  return `${clubId}/logos/${id}.png`;
}

export function fontPath(clubId: string, id: string, ext: FontExtension): string {
  return `${clubId}/fonts/${id}.${ext}`;
}

/** Public URL of a file in the club-assets bucket. */
export function assetUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${ASSETS_BUCKET}/${path}`;
}
