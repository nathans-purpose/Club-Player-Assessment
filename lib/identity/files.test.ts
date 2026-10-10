import { describe, expect, it } from "vitest";
import { assetUrl, brandDocumentKind, brandImagePath, fontExtension, parseBrandImagePath } from "./files";

const CLUB = "11111111-1111-4111-8111-111111111111";
const BATCH = "22222222-2222-4222-8222-222222222222";

describe("brandDocumentKind", () => {
  it("accepts PDF, PowerPoint, Keynote and pictures", () => {
    expect(brandDocumentKind("Profil.PDF")).toBe("pdf");
    expect(brandDocumentKind("deck.pptx")).toBe("pptx");
    expect(brandDocumentKind("deck.key")).toBe("keynote");
    expect(brandDocumentKind("logo.webp")).toBe("image");
    expect(brandDocumentKind("bild", "image/jpeg")).toBe("image");
    expect(brandDocumentKind("deck.ppt")).toBeNull();
    expect(brandDocumentKind("logo.svg", "image/svg+xml")).toBeNull();
  });
});

describe("brand image paths", () => {
  it("round-trips and refuses paths for another club or batch", () => {
    const path = brandImagePath(CLUB, BATCH, 3, "image/png");
    expect(parseBrandImagePath(CLUB, BATCH, path)).toEqual({ index: 3, contentType: "image/png" });
    expect(parseBrandImagePath(BATCH, BATCH, path)).toBeNull();
    expect(parseBrandImagePath(CLUB, CLUB, path)).toBeNull();
    expect(parseBrandImagePath(CLUB, BATCH, `${CLUB}/${BATCH}/../x.png`)).toBeNull();
  });
});

describe("fontExtension", () => {
  const head = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
  it("checks the file's signature against its extension", () => {
    expect(fontExtension("Druk.woff2", head("wOF2"))).toBe("woff2");
    expect(fontExtension("Druk.otf", head("OTTO"))).toBe("otf");
    expect(fontExtension("Druk.ttf", new Uint8Array([0, 1, 0, 0]))).toBe("ttf");
    expect(fontExtension("Druk.woff2", head("<svg"))).toBeNull();
    expect(fontExtension("Druk.eot", head("wOF2"))).toBeNull();
  });
});

describe("assetUrl", () => {
  it("points at the public club-assets bucket", () => {
    expect(assetUrl("http://127.0.0.1:54321/", `${CLUB}/logos/x.png`)).toBe(
      `http://127.0.0.1:54321/storage/v1/object/public/club-assets/${CLUB}/logos/x.png`,
    );
  });
});
