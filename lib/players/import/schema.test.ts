import { describe, expect, it } from "vitest";
import { reviewStatuses } from "../review";
import { toImportedRows, type ExtractedPlayers } from "./schema";

type Extracted = ExtractedPlayers["players"][number];

const player = (overrides: Partial<Extracted>): Extracted => ({
  shirt_number: "7",
  full_name: "Kalle Ek",
  squad_group: "MF",
  source_position_text: null,
  source_text: "7 Kalle Ek MF",
  uncertain_fields: [],
  ...overrides,
});

describe("toImportedRows", () => {
  it("cleans numbers and names and keeps the source text", () => {
    expect(toImportedRows({ players: [player({ shirt_number: " #7 ", full_name: "  Kalle   Ek " })] })).toEqual([
      { shirtNumber: "7", fullName: "Kalle Ek", squadGroup: "MF", sourceText: "7 Kalle Ek MF", uncertainFields: [] },
    ]);
  });

  it("marks a number that is not just digits as uncertain", () => {
    const [row] = toImportedRows({ players: [player({ shirt_number: "7?" })] });
    expect(row).toMatchObject({ shirtNumber: "7?", uncertainFields: ["shirt_number"] });
  });

  it("takes the squad group from the position text when Claude gave none", () => {
    const rows = toImportedRows({
      players: [
        player({ squad_group: null, source_position_text: "Målvakt" }),
        player({ squad_group: null, source_position_text: "central mittfältare", shirt_number: "8" }),
        player({ squad_group: null, source_position_text: "VB", shirt_number: "9" }),
      ],
    });
    expect(rows.map((r) => r.squadGroup)).toEqual(["MV", "MF", ""]);
  });

  it("drops rows with neither name nor number and shortens long text", () => {
    const rows = toImportedRows({
      players: [player({ shirt_number: null, full_name: " " }), player({ full_name: "A".repeat(150) })],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].fullName).toHaveLength(100);
  });

  it("feeds uncertain fields into the review statuses", () => {
    const rows = toImportedRows({
      players: [
        player({ uncertain_fields: ["full_name"] }),
        player({ shirt_number: "8", uncertain_fields: ["squad_group"] }),
        player({ shirt_number: "9", full_name: "Bo Sten" }),
      ],
    });
    expect(reviewStatuses(rows)).toEqual(["kontrollera-stavningen", "valj-lagdel", "klar"]);
  });
});
