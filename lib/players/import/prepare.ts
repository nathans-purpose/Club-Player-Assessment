import { IMAGE_MAX_BYTES, IMAGE_MAX_SIDE, importTypeOf, needsImageConversion } from "./files";

export type PreparedUpload = { body: Blob; contentType: string };

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}

/** Redraws a photo as a JPEG no larger than IMAGE_MAX_SIDE. This also drops EXIF data such as GPS position. */
async function toJpeg(file: Blob): Promise<Blob> {
  const img = await loadImage(file);
  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("jpeg"))), "image/jpeg", 0.85),
  );
}

/**
 * Gets a chosen file ready for upload. Photos are turned into JPEGs when the
 * browser can show them but Claude cannot read them (HEIC from an iPhone) or
 * when they are large. Returns null for files the import cannot read.
 */
export async function prepareUpload(file: File): Promise<PreparedUpload | null> {
  if (needsImageConversion(file.name, file.type)) {
    return { body: await toJpeg(file), contentType: "image/jpeg" };
  }
  const type = importTypeOf(file.name, file.type);
  if (!type) return null;
  if (type.kind === "image" && type.contentType !== "image/gif") {
    const img = await loadImage(file).catch(() => null);
    const tooBig =
      file.size > IMAGE_MAX_BYTES || (img && Math.max(img.naturalWidth, img.naturalHeight) > IMAGE_MAX_SIDE);
    if (tooBig) return { body: await toJpeg(file), contentType: "image/jpeg" };
  }
  return { body: file, contentType: type.contentType };
}
