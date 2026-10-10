import { clearPlainBackground } from "./background";
import {
  BRAND_IMAGE_MAX_BYTES,
  BRAND_IMAGE_MAX_SIDE,
  BRAND_MAX_HINT_CHARS,
  BRAND_MAX_IMAGES,
  type BrandDocumentKind,
  LOGO_MAX_BYTES,
} from "./files";
import { readKeynote, readPptx, type Presentation } from "./presentation";
import type { LogoBox } from "./suggestion";

// Browser side of the brand document import: turns a PDF, presentation or
// picture into a few images Claude can look at (and the browser can later
// crop logos from), plus text hints such as theme colours and font names.

export type PreparedImage = { blob: Blob; contentType: "image/png" | "image/jpeg" };
export type PreparedDocument = { images: PreparedImage[]; hints: string };

const PDF_MAX_PAGES = 6;
const LOGO_MAX_SIDE = 800;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas"))), type, quality),
  );
}

function scaledCanvas(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  return canvas;
}

/**
 * Redraws a picture at most BRAND_IMAGE_MAX_SIDE wide or high. PNGs stay PNG
 * so a logo keeps its transparency; anything else (or a PNG that is still too
 * large) becomes a JPEG on white. Redrawing also drops EXIF data.
 */
async function normalizeImage(source: Blob, preferPng: boolean): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(source);
  const canvas = scaledCanvas(bitmap.width, bitmap.height, BRAND_IMAGE_MAX_SIDE);
  const ctx = canvas.getContext("2d")!;
  if (preferPng) {
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const png = await canvasToBlob(canvas, "image/png");
    if (png.size <= BRAND_IMAGE_MAX_BYTES) return { blob: png, contentType: "image/png" };
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { blob: await canvasToBlob(canvas, "image/jpeg", 0.88), contentType: "image/jpeg" };
}

async function readPdf(file: File): Promise<PreparedDocument> {
  // The legacy build carries polyfills for browsers a year or two old (the
  // modern build needs very new JavaScript features). PDF.js runs on the page
  // instead of in a worker file, which avoids bundler setup; brand documents
  // are short.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await task.promise;
  const images: PreparedImage[] = [];
  const text: string[] = [];
  const fonts = new Set<string>();
  try {
    for (let n = 1; n <= Math.min(pdf.numPages, PDF_MAX_PAGES); n++) {
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: BRAND_IMAGE_MAX_SIDE / Math.max(base.width, base.height) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      images.push({ blob: await canvasToBlob(canvas, "image/jpeg", 0.88), contentType: "image/jpeg" });

      const content = await page.getTextContent();
      const lines = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
      if (lines.trim()) text.push(`# Sida ${n}\n${lines.replace(/\s+/g, " ").trim()}`);
      // Embedded font names, e.g. "ABCDEF+Montserrat-Bold" → "Montserrat-Bold".
      for (const item of content.items) {
        if (!("fontName" in item) || !page.commonObjs.has(item.fontName)) continue;
        const name = (page.commonObjs.get(item.fontName) as { name?: string } | null)?.name;
        if (name) fonts.add(name.replace(/^[A-Z]{6}\+/, ""));
      }
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  const hints = [
    fonts.size ? `Typsnitt i PDF-filen: ${[...fonts].join(", ")}` : "",
    text.length ? `Text:\n${text.join("\n\n")}` : "",
  ];
  return { images, hints: hints.filter(Boolean).join("\n\n") };
}

async function fromPresentation(p: Presentation): Promise<PreparedDocument> {
  const images: PreparedImage[] = [];
  for (const img of p.images) {
    const blob = new Blob([img.bytes as Uint8Array<ArrayBuffer>], { type: img.contentType });
    // A picture the browser cannot draw (a broken or unusual file) is skipped.
    const prepared = await normalizeImage(blob, img.contentType === "image/png").catch(() => null);
    if (prepared) images.push(prepared);
  }
  const hints = [
    p.colors.length ? `Temafärger: ${p.colors.map((c) => `${c.hex} (${c.slot})`).join(", ")}` : "",
    p.fonts.length
      ? `Temats typsnitt: ${p.fonts.map((f) => `${f.name} (${f.usage === "heading" ? "rubriker" : "brödtext"})`).join(", ")}`
      : "",
    p.text ? `Text på bilderna:\n${p.text}` : "",
  ];
  return { images, hints: hints.filter(Boolean).join("\n\n") };
}

/** Throws for files that cannot be read; the caller shows one message for all of them. */
export async function prepareBrandDocument(file: File, kind: BrandDocumentKind): Promise<PreparedDocument> {
  let prepared: PreparedDocument;
  if (kind === "pdf") prepared = await readPdf(file);
  else if (kind === "image") prepared = { images: [await normalizeImage(file, file.type === "image/png")], hints: "" };
  else {
    const bytes = new Uint8Array(await file.arrayBuffer());
    prepared = await fromPresentation(kind === "pptx" ? readPptx(bytes, BRAND_MAX_IMAGES) : readKeynote(bytes, BRAND_MAX_IMAGES));
  }
  if (prepared.images.length === 0) throw new Error("no images");
  return {
    images: prepared.images.slice(0, BRAND_MAX_IMAGES),
    hints: prepared.hints.slice(0, BRAND_MAX_HINT_CHARS),
  };
}

/**
 * A logo as a PNG with a transparent background: cut from `source` (the whole
 * picture when there is no box), at most LOGO_MAX_SIDE, with a plain
 * background around it made transparent.
 */
export async function logoPng(source: Blob, box?: Omit<LogoBox, "image" | "description">): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  const sx = Math.floor((box?.left ?? 0) * bitmap.width);
  const sy = Math.floor((box?.top ?? 0) * bitmap.height);
  const sw = Math.max(1, Math.round((box?.width ?? 1) * bitmap.width));
  const sh = Math.max(1, Math.round((box?.height ?? 1) * bitmap.height));
  const canvas = scaledCanvas(sw, sh, LOGO_MAX_SIDE);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (clearPlainBackground(pixels.data, canvas.width, canvas.height)) ctx.putImageData(pixels, 0, 0);
  const png = await canvasToBlob(canvas, "image/png");
  if (png.size > LOGO_MAX_BYTES) throw new Error("too large");
  return png;
}
