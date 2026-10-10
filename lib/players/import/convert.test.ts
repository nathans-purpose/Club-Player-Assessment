import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { decodeText, spreadsheetToText, UnreadableFileError, wordToText } from "./convert";

function docx(body: string): Uint8Array {
  return zipSync({
    "word/document.xml": strToU8(
      `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
    ),
  });
}

const p = (text: string) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
const cell = (text: string) => `<w:tc>${p(text)}</w:tc>`;

// The smallest .xlsx read-excel-file accepts: one sheet with inline strings and a number.
function xlsx(rows: (string | number)[][]): Uint8Array {
  const cols = "ABCDEFGH";
  const sheetRows = rows
    .map(
      (row, r) =>
        `<row r="${r + 1}">${row
          .map((v, c) =>
            typeof v === "number"
              ? `<c r="${cols[c]}${r + 1}"><v>${v}</v></c>`
              : `<c r="${cols[c]}${r + 1}" t="inlineStr"><is><t>${v}</t></is></c>`,
          )
          .join("")}</row>`,
    )
    .join("");
  return zipSync({
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Trupp" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    ),
    "xl/worksheets/sheet1.xml": strToU8(
      `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
    ),
  });
}

describe("decodeText", () => {
  it("reads UTF-8 and drops a byte order mark", () => {
    expect(decodeText(new TextEncoder().encode("﻿7;Åsa Öberg"))).toBe("7;Åsa Öberg");
  });

  it("falls back to Windows-1252 for CSV files from Swedish Excel", () => {
    // "Åsa Öberg" in Windows-1252
    const bytes = new Uint8Array([0xc5, 0x73, 0x61, 0x20, 0xd6, 0x62, 0x65, 0x72, 0x67]);
    expect(decodeText(bytes)).toBe("Åsa Öberg");
  });
});

describe("wordToText", () => {
  it("keeps paragraphs as lines and table cells as columns", () => {
    const body =
      p("Truppen P15") +
      `<w:tbl><w:tr>${cell("7")}${cell("Kalle &amp; Ek")}${cell("MF")}</w:tr><w:tr>${cell("1")}${cell("Åsa Öberg")}${cell("MV")}</w:tr></w:tbl>` +
      p("Tränare: Test Testsson");
    expect(wordToText(docx(body))).toBe("Truppen P15\n7\tKalle & Ek\tMF\n1\tÅsa Öberg\tMV\nTränare: Test Testsson");
  });

  it("throws UnreadableFileError for files that are not .docx", () => {
    expect(() => wordToText(new TextEncoder().encode("not a zip"))).toThrow(UnreadableFileError);
  });
});

describe("spreadsheetToText", () => {
  it("turns each sheet into tab-separated lines under its name", async () => {
    const text = await spreadsheetToText(
      xlsx([
        ["Nr", "Namn", "Lagdel"],
        [7, "Kalle Ek", "MF"],
      ]),
    );
    expect(text).toBe("# Trupp\nNr\tNamn\tLagdel\n7\tKalle Ek\tMF");
  });

  it("throws UnreadableFileError for broken files", async () => {
    await expect(spreadsheetToText(new TextEncoder().encode("nope"))).rejects.toThrow(UnreadableFileError);
  });
});
