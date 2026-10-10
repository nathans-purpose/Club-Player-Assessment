import { describe, expect, it } from "vitest";
import { type BrandExtraction, toBrandSuggestion } from "./suggestion";

const base: BrandExtraction = { colors: [], fonts: [], tone_words: [], logos: [] };

describe("toBrandSuggestion", () => {
  it("keeps valid colours once, with at most one main and one complementary colour", () => {
    const s = toBrandSuggestion(
      {
        ...base,
        colors: [
          { hex: "#509bf5", role: "primary", name: " Solnablå " },
          { hex: "509BF5", role: "other", name: null },
          { hex: "#0B1F3A", role: "primary", name: null },
          { hex: "blå", role: "secondary", name: null },
          { hex: "#FFF", role: "secondary", name: "" },
        ],
      },
      1,
    );
    expect(s.colors).toEqual([
      { hex: "#509BF5", role: "primary", name: "Solnablå" },
      { hex: "#0B1F3A", role: "other", name: null },
      { hex: "#FFFFFF", role: "secondary", name: null },
    ]);
  });

  it("makes the first colour the main one when none is named", () => {
    const s = toBrandSuggestion({ ...base, colors: [{ hex: "#0B1F3A", role: "other", name: null }] }, 1);
    expect(s.colors[0].role).toBe("primary");
  });

  it("picks a heading and a body font and strips characters a font name cannot have", () => {
    const s = toBrandSuggestion(
      {
        ...base,
        fonts: [
          { name: 'Druk Wide"; }', usage: "heading", style: "extended" },
          { name: "Georgia", usage: "other", style: "serif" },
          { name: "Inter", usage: "body", style: "sans" },
        ],
      },
      1,
    );
    expect(s.fonts).toEqual({
      heading: { name: "Druk Wide", style: "extended" },
      body: { name: "Inter", style: "sans" },
    });
  });

  it("keeps short unique tone words", () => {
    const s = toBrandSuggestion({ ...base, tone_words: ["Stolt", "stolt", "  Modig ", ""] }, 1);
    expect(s.toneWords).toEqual(["Stolt", "Modig"]);
  });

  it("keeps logo boxes on images Claude was shown, clamped to the image", () => {
    const s = toBrandSuggestion(
      {
        ...base,
        logos: [
          { image: 1, left: 0.8, top: -0.1, width: 0.5, height: 0.3, description: "Klubbmärke" },
          { image: 3, left: 0, top: 0, width: 1, height: 1, description: null },
          { image: 0, left: 0, top: 0, width: 1, height: 1, description: null },
          { image: 2, left: 0.5, top: 0.5, width: 0, height: 0.2, description: null },
        ],
      },
      2,
    );
    expect(s.logos).toHaveLength(1);
    expect(s.logos[0]).toMatchObject({ image: 0, left: 0.8, top: 0, height: 0.3, description: "Klubbmärke" });
    expect(s.logos[0].width).toBeCloseTo(0.2);
  });
});
