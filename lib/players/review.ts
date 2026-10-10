import type { UncertainField } from "./import/schema";
import type { SquadGroup } from "./squad-groups";

export type ReviewRow = {
  shirtNumber: string;
  fullName: string;
  squadGroup: SquadGroup | "";
  /** Fields an importer was unsure about, e.g. ["full_name"]. */
  uncertainFields?: UncertainField[];
};

export type ReviewStatus = "klar" | "kontrollera-stavningen" | "nummer-saknas" | "valj-lagdel" | "dubblett";

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  klar: "Klar",
  "kontrollera-stavningen": "Kontrollera stavningen",
  "nummer-saknas": "Nummer saknas",
  "valj-lagdel": "Välj lagdel",
  dubblett: "Dubblett",
};

export function isBlankRow(row: Pick<ReviewRow, "shirtNumber" | "fullName">): boolean {
  return !row.shirtNumber.trim() && !row.fullName.trim();
}

function duplicateKey(shirtNumber: string, fullName: string): string {
  return `${shirtNumber.trim()}|${fullName.trim().replace(/\s+/g, " ").toLocaleLowerCase("sv")}`;
}

function looksMisspelled(row: ReviewRow): boolean {
  const name = row.fullName.trim();
  // An importer that could not read the name or number well asks for a look.
  if (row.uncertainFields?.includes("full_name") || row.uncertainFields?.includes("shirt_number")) return true;
  // A first name only, digits, or characters names don't usually have.
  return name.split(/\s+/).length < 2 || /[\d_@#$%&*=+<>{}[\]\\/|~^]/.test(name);
}

/**
 * Status per row, derived from the content only. Blank rows get null. A row
 * is a duplicate when another row, or an existing player, has the same name
 * and number. Only the most important problem is reported.
 */
export function reviewStatuses(
  rows: ReviewRow[],
  existing: { shirtNumber: string | null; fullName: string }[] = [],
): (ReviewStatus | null)[] {
  const counts = new Map<string, number>();
  for (const p of existing) {
    const key = duplicateKey(p.shirtNumber ?? "", p.fullName);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const row of rows) {
    if (isBlankRow(row)) continue;
    const key = duplicateKey(row.shirtNumber, row.fullName);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return rows.map((row) => {
    if (isBlankRow(row)) return null;
    if ((counts.get(duplicateKey(row.shirtNumber, row.fullName)) ?? 0) > 1) return "dubblett";
    if (!row.fullName.trim() || looksMisspelled(row)) return "kontrollera-stavningen";
    if (!row.shirtNumber.trim()) return "nummer-saknas";
    if (!row.squadGroup || row.uncertainFields?.includes("squad_group")) return "valj-lagdel";
    return "klar";
  });
}

export function needsCheck(status: ReviewStatus | null): boolean {
  return status !== null && status !== "klar";
}
