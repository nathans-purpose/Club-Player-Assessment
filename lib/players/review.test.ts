import { describe, expect, it } from "vitest";
import { needsCheck, reviewStatuses, type ReviewRow } from "./review";

const row = (shirtNumber: string, fullName: string, squadGroup: ReviewRow["squadGroup"] = "MF"): ReviewRow => ({
  shirtNumber,
  fullName,
  squadGroup,
});

describe("reviewStatuses", () => {
  it("marks complete rows as Klar and ignores blank rows", () => {
    expect(reviewStatuses([row("7", "Kalle Ek"), row("", "", "")])).toEqual(["klar", null]);
  });

  it("flags a missing number, a missing group and a doubtful name", () => {
    expect(
      reviewStatuses([row("", "Kalle Ek"), row("8", "Bo Sten", ""), row("9", "Kalle"), row("10", "Ek3 Sten")]),
    ).toEqual(["nummer-saknas", "valj-lagdel", "kontrollera-stavningen", "kontrollera-stavningen"]);
  });

  it("flags fields an importer was unsure about", () => {
    expect(reviewStatuses([{ ...row("7", "Kalle Ek"), uncertainFields: ["full_name"] }])).toEqual([
      "kontrollera-stavningen",
    ]);
  });

  it("flags a number without a name", () => {
    expect(reviewStatuses([row("7", "")])).toEqual(["kontrollera-stavningen"]);
  });

  it("marks every copy of the same name and number as Dubblett", () => {
    expect(reviewStatuses([row("7", "Kalle Ek"), row("7", " kalle  ek "), row("8", "Kalle Ek")])).toEqual([
      "dubblett",
      "dubblett",
      "klar",
    ]);
  });

  it("finds duplicates of players already in the squad", () => {
    expect(reviewStatuses([row("7", "Kalle Ek")], [{ shirtNumber: "7", fullName: "Kalle Ek" }])).toEqual(["dubblett"]);
    expect(reviewStatuses([row("", "Kalle Ek")], [{ shirtNumber: null, fullName: "Kalle Ek" }])).toEqual(["dubblett"]);
  });

  it("re-derives the status when the content changes", () => {
    const rows = [row("7", "Kalle Ek"), row("7", "Kalle Ek")];
    expect(reviewStatuses(rows)).toEqual(["dubblett", "dubblett"]);
    rows[1] = row("17", "Kalle Ek");
    expect(reviewStatuses(rows)).toEqual(["klar", "klar"]);
  });
});

describe("needsCheck", () => {
  it("is true for everything but Klar and blank rows", () => {
    expect([null, "klar", "dubblett", "valj-lagdel"].map((s) => needsCheck(s as never))).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });
});
