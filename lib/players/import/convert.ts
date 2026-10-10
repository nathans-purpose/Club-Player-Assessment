import { strFromU8, unzipSync } from "fflate";
import readXlsxFile from "read-excel-file/node";

/** Text longer than this is refused rather than cut off (a squad list is far shorter). */
export const MAX_TEXT_CHARS = 100_000;

export class UnreadableFileError extends Error {}

/** Decodes text files as UTF-8, or Windows-1252 when that fails (CSV saved by Swedish Excel). */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** Every sheet as tab-separated rows, each sheet under its name. */
export async function spreadsheetToText(bytes: Uint8Array): Promise<string> {
  let sheets;
  try {
    sheets = await readXlsxFile(Buffer.from(bytes));
  } catch {
    throw new UnreadableFileError("spreadsheet");
  }
  return sheets
    .map(({ sheet, data }) => {
      const rows = data
        .map((row) =>
          row
            .map((cell) =>
              cell === null || cell === undefined
                ? ""
                : cell instanceof Date
                  ? cell.toISOString().slice(0, 10)
                  : String(cell),
            )
            .join("\t")
            .replace(/\t+$/, ""),
        )
        .filter((line) => line.trim());
      return rows.length ? `# ${sheet}\n${rows.join("\n")}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXmlText(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return XML_ENTITIES[entity.toLowerCase()] ?? whole;
  });
}

/**
 * Plain text of a Word (.docx) file: paragraphs on their own lines and table
 * cells separated by tabs, so a squad table keeps its columns.
 */
export function wordToText(bytes: Uint8Array): string {
  let xml: string;
  try {
    const files = unzipSync(bytes, { filter: (file) => file.name === "word/document.xml" });
    const doc = files["word/document.xml"];
    if (!doc) throw new Error("no document.xml");
    xml = strFromU8(doc);
  } catch {
    throw new UnreadableFileError("word");
  }
  const text = xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    // A cell's last paragraph ends the cell, not the line.
    .replace(/<\/w:p>(\s*<\/w:tc>)/g, "$1")
    .replace(/<\/w:tc>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeXmlText(text)
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .filter((line) => line.trim())
    .join("\n");
}
