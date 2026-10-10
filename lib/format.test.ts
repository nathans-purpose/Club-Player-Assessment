import { describe, expect, it } from "vitest";
import { formatCount, formatDate, formatPercent, formatRate, formatRateShort, formatScore } from "./format";

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

describe("formatRate", () => {
  it("uses two decimals and full words", () => {
    expect(formatRate(0.654)).toBe("0,65 per match");
    expect(formatRateShort(0.5)).toBe("0,50");
    expect(formatRate(null)).toBe("–");
  });
});

describe("formatCount", () => {
  it("shows whole numbers", () => {
    expect(formatCount(12)).toBe("12");
    expect(formatCount(null)).toBe("–");
  });
});

describe("formatDate", () => {
  it("writes the date in Swedish, in Swedish time", () => {
    expect(formatDate("2026-10-10T08:00:00Z")).toBe("10 oktober 2026");
    expect(formatDate("2026-10-09T22:30:00Z")).toBe("10 oktober 2026");
  });
});
