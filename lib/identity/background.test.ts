import { describe, expect, it } from "vitest";
import { clearPlainBackground, plainBorderColor } from "./background";

/** A white square image with a blue block in the middle (and a white hole inside it). */
function logoOnWhite(size = 20) {
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 5; y < 15; y++) {
    for (let x = 5; x < 15; x++) {
      const hole = x >= 9 && x < 11 && y >= 9 && y < 11;
      const i = (y * size + x) * 4;
      if (!hole) [data[i], data[i + 1], data[i + 2]] = [0x50, 0x9b, 0xf5];
    }
  }
  return data;
}

const alpha = (data: Uint8ClampedArray, size: number, x: number, y: number) => data[(y * size + x) * 4 + 3];

describe("clearPlainBackground", () => {
  it("makes the plain background transparent and keeps the logo and enclosed holes", () => {
    const data = logoOnWhite();
    expect(clearPlainBackground(data, 20, 20)).toBe(true);
    expect(alpha(data, 20, 0, 0)).toBe(0);
    expect(alpha(data, 20, 4, 10)).toBe(0);
    expect(alpha(data, 20, 6, 6)).toBe(255);
    // The white hole inside the block does not touch the edge.
    expect(alpha(data, 20, 10, 10)).toBe(255);
  });

  it("leaves a busy background alone", () => {
    const data = logoOnWhite();
    for (let i = 0; i < data.length; i += 4) {
      data[i] = (i * 37) % 256;
      data[i + 1] = (i * 91) % 256;
    }
    expect(plainBorderColor(data, 20, 20)).toBeNull();
    expect(clearPlainBackground(data, 20, 20)).toBe(false);
  });

  it("leaves an image that is already transparent alone", () => {
    const data = logoOnWhite();
    for (let i = 3; i < data.length; i += 4) data[i] = 0;
    expect(clearPlainBackground(data, 20, 20)).toBe(false);
  });
});
