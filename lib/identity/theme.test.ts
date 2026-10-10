import { describe, expect, it } from "vitest";
import { assetsBelongTo, EMPTY_IDENTITY, fromRow, type Identity, toRow } from "./schema";
import { primaryContrast, themeCss, themeTokens } from "./theme";

const CLUB = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const FILE = "33333333-3333-4333-8333-333333333333";

const SOLNA: Identity = {
  colors: [
    { hex: "#509BF5", role: "primary", name: "Solnablå" },
    { hex: "#0B1F3A", role: "secondary", name: null },
    { hex: "#F5C524", role: "other", name: null },
  ],
  fonts: {
    heading: { name: "Druk Wide", style: "extended", file: null },
    body: { name: "Inter", style: "sans", file: `${CLUB}/fonts/${FILE}.woff2` },
  },
  logos: [{ path: `${CLUB}/logos/${FILE}.png`, description: "Klubbmärke" }],
  toneWords: ["Stolt", "Modig"],
};

const url = (path: string) => `https://example.supabase.co/storage/v1/object/public/club-assets/${path}`;

describe("primaryContrast", () => {
  it("derives a darker text colour and dark button text for a light main colour", () => {
    const c = primaryContrast(SOLNA)!;
    expect(c.adjusted).toBe(true);
    expect(c.ink).not.toBe("#509BF5");
    expect(c.onPrimary).toBe("#14171A");
  });
  it("is null without a main colour", () => {
    expect(primaryContrast(EMPTY_IDENTITY)).toBeNull();
  });
});

describe("themeTokens", () => {
  it("sets the brand tokens and falls back for fonts without a file", () => {
    const { vars, fontFaces } = themeTokens(SOLNA, url);
    expect(vars["--primary"]).toBe("#509BF5");
    expect(vars["--on-primary"]).toBe("#14171A");
    expect(vars["--brand-stripe"]).toBe("#0B1F3A");
    // Druk Wide is licensed and not uploaded: Archivo, extended.
    expect(vars["--font-heading"]).toContain("--font-archivo");
    expect(vars["--heading-stretch"]).toBe("125%");
    expect(vars["--font-body"]).toMatch(/^"Club Body", /);
    expect(fontFaces).toEqual([{ slot: "body", url: url(`${CLUB}/fonts/${FILE}.woff2`), format: "woff2" }]);
  });

  it("never touches the assessment colour scale or the page background", () => {
    const { vars } = themeTokens(SOLNA, url);
    expect(Object.keys(vars).some((k) => k.startsWith("--scale") || k === "--background" || k === "--pitch")).toBe(false);
  });

  it("drops a font file whose URL could break out of the stylesheet", () => {
    const { fontFaces, vars } = themeTokens(SOLNA, () => 'https://x.test/a.woff2") ; } body { display:none');
    expect(fontFaces).toEqual([]);
    expect(vars["--font-body"]).not.toContain("Club Body");
  });
});

describe("themeCss", () => {
  it("is empty for the default identity", () => {
    expect(themeCss(EMPTY_IDENTITY, url).trim()).toBe("");
  });
  it("writes font faces and one :root rule without anything that ends a <style>", () => {
    const css = themeCss(SOLNA, url);
    expect(css).toContain('@font-face{font-family:"Club Body"');
    expect(css).toContain(":root{--primary:#509BF5;");
    expect(css).not.toMatch(/<|>/);
  });
});

describe("fromRow / toRow", () => {
  const row = (identity: Identity) => ({ ...toRow(identity), is_applied: true });

  it("round-trips a valid identity", () => {
    expect(fromRow(row(SOLNA), CLUB)).toEqual(SOLNA);
  });

  it("refuses rows that could inject CSS or point at another club's files", () => {
    const evil = { ...row(SOLNA), colors: { palette: [{ hex: "red;}body{display:none", role: "primary", name: null }] } };
    expect(fromRow(evil, CLUB)).toBeNull();
    const badFont = {
      ...row(SOLNA),
      fonts: { heading: { name: 'Inter"; } body {', style: "sans", file: null }, body: null },
    };
    expect(fromRow(badFont, CLUB)).toBeNull();
    expect(fromRow(row(SOLNA), OTHER)).toBeNull();
    expect(assetsBelongTo(SOLNA, OTHER)).toBe(false);
  });

  it("refuses two main colours", () => {
    const two = { ...SOLNA, colors: [SOLNA.colors[0], { ...SOLNA.colors[2], role: "primary" as const }] };
    expect(fromRow(row(two), CLUB)).toBeNull();
  });

  it("reads an empty row as the default identity", () => {
    expect(fromRow({ colors: {}, fonts: {}, logos: {}, tone_words: [], is_applied: false }, CLUB)).toEqual(EMPTY_IDENTITY);
    expect(fromRow(null, CLUB)).toBeNull();
  });
});
