// Which files the player import accepts. Shared by the browser (to check and
// label a file before uploading) and the server (to decide how to read it).

export const IMPORT_BUCKET = "player-imports";
export const IMPORT_MAX_BYTES = 20 * 1024 * 1024;
/** Claude reads images up to 5 MB; the browser shrinks larger photos first. */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
/** Longest image side sent to Claude; larger photos are scaled down. */
export const IMAGE_MAX_SIDE = 2400;

export type ImportKind = "image" | "pdf" | "spreadsheet" | "csv" | "text" | "word";

/** Canonical content type per extension; the bucket only allows these. */
const BY_EXTENSION: Record<string, { kind: ImportKind; contentType: string }> = {
  png: { kind: "image", contentType: "image/png" },
  jpg: { kind: "image", contentType: "image/jpeg" },
  jpeg: { kind: "image", contentType: "image/jpeg" },
  webp: { kind: "image", contentType: "image/webp" },
  gif: { kind: "image", contentType: "image/gif" },
  pdf: { kind: "pdf", contentType: "application/pdf" },
  xlsx: { kind: "spreadsheet", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  csv: { kind: "csv", contentType: "text/csv" },
  txt: { kind: "text", contentType: "text/plain" },
  docx: { kind: "word", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
};

const BY_CONTENT_TYPE = new Map(Object.values(BY_EXTENSION).map((v) => [v.contentType, v]));

/** The `accept` attribute for the file input. */
export const IMPORT_ACCEPT = [
  ...Object.keys(BY_EXTENSION).map((ext) => `.${ext}`),
  // Phones offer HEIC photos; the browser converts them to JPEG before upload.
  "image/*",
].join(",");

export function extensionOf(name: string): string {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

/**
 * Works out how to read a file from its name, falling back to its content
 * type (photos from a phone camera often have no useful name). Returns null
 * for files the import cannot read, such as old .xls and .doc files.
 */
export function importTypeOf(name: string, contentType = ""): { kind: ImportKind; contentType: string } | null {
  return BY_EXTENSION[extensionOf(name)] ?? BY_CONTENT_TYPE.get(contentType.toLowerCase()) ?? null;
}

/** True for image types the browser should convert to JPEG (e.g. HEIC from an iPhone). */
export function needsImageConversion(name: string, contentType: string): boolean {
  return !importTypeOf(name, contentType) && contentType.startsWith("image/");
}

/** Storage path for an upload: `<clubId>/<random>.<ext>`. The original name is not stored. */
export function importPath(clubId: string, id: string, contentType: string): string {
  const ext = Object.entries(BY_EXTENSION).find(([, v]) => v.contentType === contentType)?.[0] ?? "bin";
  return `${clubId}/${id}.${ext}`;
}

const PATH_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[0-9a-f-]{36}\.([a-z]+)$/i;

/** Checks that a path was made by importPath for this club and returns how to read it. */
export function parseImportPath(clubId: string, path: string): { kind: ImportKind; contentType: string } | null {
  const match = path.match(PATH_PATTERN);
  if (!match || match[1].toLowerCase() !== clubId.toLowerCase()) return null;
  return BY_EXTENSION[match[2].toLowerCase()] ?? null;
}
