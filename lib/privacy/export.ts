/**
 * Club data export (spec §8): every table the club owns, as one JSON file or
 * as a zip with one CSV file per table.
 */

export type ExportRow = Record<string, unknown>;
export type ClubExport = { exportedAt: string; club: ExportRow | null; tables: Record<string, ExportRow[]> };

// Cells starting with these could run as formulas in a spreadsheet program.
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * One table as CSV: semicolon-separated (what Swedish Excel expects), with a
 * byte order mark so å, ä and ö open correctly. Columns are the union of the
 * rows' keys, in first-seen order.
 */
export function toCsv(rows: ExportRow[]): string {
  const columns: string[] = [];
  for (const row of rows) for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key);
  const lines = [columns.map(cell).join(";"), ...rows.map((row) => columns.map((c) => cell(row[c])).join(";"))];
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** File name for the download: the club's slug and the date, e.g. `exempelklubben-if-2026-10-10`. */
export function exportFileName(slug: string, date: Date): string {
  const safe =
    slug
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "klubb";
  return `${safe}-${date.toISOString().slice(0, 10)}`;
}

/** The CSV files of an export, by file name. */
export function exportCsvFiles(data: ClubExport): Record<string, string> {
  const files: Record<string, string> = {};
  if (data.club) files["club.csv"] = toCsv([data.club]);
  for (const [table, rows] of Object.entries(data.tables)) files[`${table}.csv`] = toCsv(rows);
  return files;
}
