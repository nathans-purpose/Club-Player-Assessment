import { describe, expect, it } from "vitest";
import { importPath, importTypeOf, needsImageConversion, parseImportPath } from "./files";

const CLUB = "11111111-2222-3333-4444-555555555555";
const ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("importTypeOf", () => {
  it("reads the kind from the extension, whatever the browser says", () => {
    expect(importTypeOf("Truppen.XLSX", "")).toMatchObject({ kind: "spreadsheet" });
    // Windows reports CSV files as Excel files.
    expect(importTypeOf("trupp.csv", "application/vnd.ms-excel")).toEqual({ kind: "csv", contentType: "text/csv" });
    expect(importTypeOf("lista.docx")).toMatchObject({ kind: "word" });
    expect(importTypeOf("scan.pdf")).toEqual({ kind: "pdf", contentType: "application/pdf" });
  });

  it("falls back to the content type for nameless camera photos", () => {
    expect(importTypeOf("image", "image/jpeg")).toEqual({ kind: "image", contentType: "image/jpeg" });
  });

  it("refuses old Office formats and other files", () => {
    expect(importTypeOf("trupp.xls", "application/vnd.ms-excel")).toBeNull();
    expect(importTypeOf("trupp.doc", "application/msword")).toBeNull();
    expect(importTypeOf("bild.svg", "image/svg+xml")).toBeNull();
  });
});

describe("needsImageConversion", () => {
  it("is true for images Claude cannot read, such as HEIC", () => {
    expect(needsImageConversion("IMG_1.HEIC", "image/heic")).toBe(true);
    expect(needsImageConversion("bild.png", "image/png")).toBe(false);
    expect(needsImageConversion("trupp.xls", "application/vnd.ms-excel")).toBe(false);
  });
});

describe("import paths", () => {
  it("round-trips a path made for the club", () => {
    const path = importPath(CLUB, ID, "application/pdf");
    expect(path).toBe(`${CLUB}/${ID}.pdf`);
    expect(parseImportPath(CLUB, path)).toEqual({ kind: "pdf", contentType: "application/pdf" });
  });

  it("rejects paths in another club's folder or outside the pattern", () => {
    const other = "99999999-2222-3333-4444-555555555555";
    expect(parseImportPath(other, `${CLUB}/${ID}.pdf`)).toBeNull();
    expect(parseImportPath(CLUB, `${CLUB}/../${other}/${ID}.pdf`)).toBeNull();
    expect(parseImportPath(CLUB, `${CLUB}/${ID}.exe`)).toBeNull();
    expect(parseImportPath(CLUB, `${CLUB}/lista.pdf`)).toBeNull();
  });
});
