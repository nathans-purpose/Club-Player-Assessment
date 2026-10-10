import { strFromU8, unzipSync, zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { exportCsvFiles, exportFileName, toCsv } from "./export";

describe("toCsv", () => {
  it("writes a header from all keys and quotes what needs quoting", () => {
    const csv = toCsv([
      { name: "Anna Andersson", comment: 'Säger "hej"; alltid' },
      { name: "Bo", goals: 3, extra: null },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual([
      "name;comment;goals;extra",
      'Anna Andersson;"Säger ""hej""; alltid";;',
      "Bo;;3;",
      "",
    ]);
  });

  it("keeps text that looks like a formula from running in a spreadsheet", () => {
    expect(toCsv([{ comment: "=HYPERLINK(1)" }, { comment: "-1 i snitt" }])).toContain("'=HYPERLINK(1)\r\n'-1 i snitt");
    // Numbers stay numbers.
    expect(toCsv([{ score: -1 }])).toContain("\r\n-1\r\n");
  });

  it("writes nested values as JSON", () => {
    expect(toCsv([{ colors: [{ hex: "#509BF5" }] }])).toContain('"[{""hex"":""#509BF5""}]"');
  });
});

describe("exportCsvFiles", () => {
  it("makes one file per table plus the club, and survives a zip round trip", () => {
    const files = exportCsvFiles({
      exportedAt: "2026-10-10T10:00:00Z",
      club: { id: "c1", name: "Klubben" },
      tables: { players: [{ full_name: "Åsa Öberg" }], assessments: [] },
    });
    expect(Object.keys(files)).toEqual(["club.csv", "players.csv", "assessments.csv"]);
    const zip = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));
    expect(strFromU8(unzipSync(zip)["players.csv"])).toContain("Åsa Öberg");
  });
});

describe("exportFileName", () => {
  it("uses the slug and the date", () => {
    expect(exportFileName("Exempelklubben IF", new Date("2026-10-10T12:00:00Z"))).toBe("exempelklubben-if-2026-10-10");
    expect(exportFileName("///", new Date("2026-10-10T12:00:00Z"))).toBe("klubb-2026-10-10");
  });
});
