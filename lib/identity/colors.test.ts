import { describe, expect, it } from "vitest";
import { contrastRatio, DARK_TEXT, formatRatio, normalizeHex, TEXT_CONTRAST, textOn, textVariant, WHITE } from "./colors";

describe("normalizeHex", () => {
  it("accepts short and long forms, with or without #", () => {
    expect(normalizeHex("#509bf5")).toBe("#509BF5");
    expect(normalizeHex("509BF5")).toBe("#509BF5");
    expect(normalizeHex(" #abc ")).toBe("#AABBCC");
  });
  it("refuses anything else", () => {
    for (const v of ["", "#12345", "blue", "#12345G", "#509BF5;}", "rgb(0,0,0)"]) expect(normalizeHex(v)).toBeNull();
  });
});

describe("contrastRatio", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBe(1);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#509BF5", WHITE)).toBeCloseTo(2.86, 2);
  });
});

describe("textVariant", () => {
  it("keeps a colour that already reads on white", () => {
    expect(textVariant("#1F5C3A")).toBe("#1F5C3A");
  });

  it("darkens a light colour until it reaches 4.5:1, keeping the hue (spec example: Solna FC blue)", () => {
    const variant = textVariant("#509BF5");
    expect(contrastRatio(variant, WHITE)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    // Close to the spec's #2F6FCC: still clearly blue, not much darker than needed.
    expect(contrastRatio(variant, WHITE)).toBeLessThan(5);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(variant.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(r);
  });

  it("passes on every background it is given", () => {
    for (const c of ["#F5C524", "#E5484D", "#A3F01A", "#FFFFFF"]) {
      const v = textVariant(c, [WHITE, "#F6F7F5"]);
      expect(contrastRatio(v, "#F6F7F5")).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    }
  });
});

describe("textOn", () => {
  it("uses white on dark buttons and dark text on light ones", () => {
    expect(textOn("#1F5C3A")).toBe(WHITE);
    expect(textOn("#509BF5")).toBe(DARK_TEXT);
    expect(textOn("#F5C524")).toBe(DARK_TEXT);
  });
});

describe("formatRatio", () => {
  it("uses a decimal comma and never rounds up past a threshold", () => {
    expect(formatRatio(4.4999)).toBe("4,49:1");
    expect(formatRatio(21)).toBe("21,00:1");
  });
});
