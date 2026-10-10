import { z } from "zod/v4";
import { isSquadGroup, squadGroupFromWord, type SquadGroup } from "../squad-groups";

export const UNCERTAIN_FIELDS = ["shirt_number", "full_name", "squad_group"] as const;
export type UncertainField = (typeof UNCERTAIN_FIELDS)[number];

/**
 * What Claude returns for an uploaded player list (spec §7.1). The players sit
 * under one key because structured output needs an object at the top level.
 * `source_text` (the row as written in the document) is shown in the review
 * table so the admin can compare.
 */
export const ExtractedPlayersSchema = z.object({
  players: z.array(
    z.object({
      shirt_number: z.string().nullable(),
      full_name: z.string(),
      squad_group: z.enum(["MV", "FÖ", "MF", "AN"]).nullable(),
      source_position_text: z.string().nullable(),
      source_text: z.string().nullable(),
      uncertain_fields: z.array(z.enum(UNCERTAIN_FIELDS)),
    }),
  ),
});

export type ExtractedPlayers = z.infer<typeof ExtractedPlayersSchema>;

/** A row for the review table, before the admin has checked it. */
export type ImportedRow = {
  shirtNumber: string;
  fullName: string;
  squadGroup: SquadGroup | "";
  sourceText: string;
  uncertainFields: UncertainField[];
};

const clean = (value: string | null | undefined, max: number) =>
  (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * Turns Claude's answer into review rows: trims and shortens the text, keeps
 * only digits in a shirt number ("#7" → "7"), falls back to the position text
 * for the squad group, and drops rows without a name or number.
 */
export function toImportedRows(extracted: ExtractedPlayers): ImportedRow[] {
  const rows: ImportedRow[] = [];
  for (const p of extracted.players) {
    const fullName = clean(p.full_name, 100);
    const rawNumber = clean(p.shirt_number, 10);
    const digits = rawNumber.match(/^#?(\d{1,3})\.?$/)?.[1];
    const shirtNumber = digits ?? rawNumber;
    if (!fullName && !shirtNumber) continue;

    const uncertain = new Set<UncertainField>(p.uncertain_fields);
    // A number that is not just digits needs a look ("7?", "sju").
    if (shirtNumber && !digits) uncertain.add("shirt_number");

    let squadGroup: SquadGroup | "" = isSquadGroup(p.squad_group) ? p.squad_group : "";
    if (!squadGroup && p.source_position_text) {
      // "MF", "Mittfält" or a longer text such as "central mittfältare".
      const text = clean(p.source_position_text, 60);
      squadGroup = [text, ...text.split(" ")].map(squadGroupFromWord).find(Boolean) ?? "";
    }

    const sourceText = clean(p.source_text, 200) || clean(p.source_position_text, 200);
    rows.push({
      shirtNumber,
      fullName,
      squadGroup,
      sourceText,
      uncertainFields: UNCERTAIN_FIELDS.filter((f) => uncertain.has(f)),
    });
  }
  return rows;
}
