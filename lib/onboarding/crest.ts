export const CREST_MAX_BYTES = 2 * 1024 * 1024;

// No SVG: the bucket is public and SVG can carry scripts.
export const CREST_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
