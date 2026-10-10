import { describe, expect, it } from "vitest";
import { formatPercent, formatScore } from "./format";

describe("formatScore", () => {
  it("uses one decimal and a comma", () => {
    expect(formatScore(7.25)).toBe("7,3");
    expect(formatScore(8)).toBe("8,0");
  });
  it("shows a dash for no value", () => {
    expect(formatScore(null)).toBe("–");
  });
});

describe("formatPercent", () => {
  it("rounds to whole percent", () => {
    expect(formatPercent(79.6)).toBe("80 %");
    expect(formatPercent(null)).toBe("–");
  });
});
