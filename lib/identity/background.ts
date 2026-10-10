// Makes the plain background around a cropped logo transparent, so a logo cut
// from a slide or a page sits on any colour (spec §7.2: PNG with transparency).
// Works on raw RGBA pixels, so it runs the same in the browser and in tests.

/** How far (0–441) a pixel may be from the background colour and still count as background. */
const TOLERANCE = 40;
/** Pixels between TOLERANCE and this get partial transparency, for smooth edges. */
const SOFT_EDGE = 70;

const distance = (data: Uint8ClampedArray, i: number, [r, g, b]: number[]) =>
  Math.hypot(data[i] - r, data[i + 1] - g, data[i + 2] - b);

/**
 * The background colour when the image's border is (almost) one plain colour,
 * otherwise null: a logo on a photo keeps its background.
 */
export function plainBorderColor(data: Uint8ClampedArray, width: number, height: number): number[] | null {
  const border: number[] = [];
  for (let x = 0; x < width; x++) border.push(x, x + (height - 1) * width);
  for (let y = 1; y < height - 1; y++) border.push(y * width, y * width + width - 1);
  // Already transparent around the edges: nothing to do.
  const opaque = border.filter((p) => data[p * 4 + 3] > 16);
  if (opaque.length < border.length * 0.5) return null;

  const channel = (offset: number) => {
    const values = opaque.map((p) => data[p * 4 + offset]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  };
  const color = [channel(0), channel(1), channel(2)];
  const close = opaque.filter((p) => distance(data, p * 4, color) <= TOLERANCE).length;
  return close >= opaque.length * 0.85 ? color : null;
}

/**
 * Flood-fills from the edges and clears every connected pixel close to the
 * border colour, so the background inside letters (the hole in an "O") is
 * only cleared when it touches the edge. Changes `data` in place and returns
 * whether anything changed.
 */
export function clearPlainBackground(data: Uint8ClampedArray, width: number, height: number): boolean {
  const color = plainBorderColor(data, width, height);
  if (!color) return false;

  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (p: number) => {
    if (!seen[p]) {
      seen[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < width; x++) {
    push(x);
    push(x + (height - 1) * width);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }

  while (stack.length) {
    const p = stack.pop()!;
    const i = p * 4;
    const d = distance(data, i, color);
    if (d > SOFT_EDGE) continue;
    if (d <= TOLERANCE) {
      data[i + 3] = 0;
    } else {
      // An edge pixel: keep it, partly see-through, and stop spreading.
      data[i + 3] = Math.min(data[i + 3], Math.round((255 * (d - TOLERANCE)) / (SOFT_EDGE - TOLERANCE)));
      continue;
    }
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) push(p - 1);
    if (x < width - 1) push(p + 1);
    if (y > 0) push(p - width);
    if (y < height - 1) push(p + width);
  }
  return true;
}
