import { describe, expect, it } from "vitest";
import { parsePlayerLines } from "./parse";

describe("parsePlayerLines", () => {
  it("reads number, name and group word", () => {
    expect(parsePlayerLines("7 Kalle Ek mittfält\n1 Bo Sten MV")).toEqual([
      { shirtNumber: "7", fullName: "Kalle Ek", squadGroup: "MF", sourceText: "7 Kalle Ek mittfält" },
      { shirtNumber: "1", fullName: "Bo Sten", squadGroup: "MV", sourceText: "1 Bo Sten MV" },
    ]);
  });

  it("makes number and group optional", () => {
    expect(parsePlayerLines("Kalle Ek")).toEqual([
      { shirtNumber: null, fullName: "Kalle Ek", squadGroup: null, sourceText: "Kalle Ek" },
    ]);
  });

  it("handles common number formats and separators", () => {
    const [a, b, c] = parsePlayerLines("#10 Ali Berg\n9. Sam Lind, anfall\n12\tEva Dahl\t(FÖ)");
    expect(a).toMatchObject({ shirtNumber: "10", fullName: "Ali Berg", squadGroup: null });
    expect(b).toMatchObject({ shirtNumber: "9", fullName: "Sam Lind", squadGroup: "AN" });
    expect(c).toMatchObject({ shirtNumber: "12", fullName: "Eva Dahl", squadGroup: "FÖ" });
  });

  it("skips blank lines and keeps a lone word as a name", () => {
    expect(parsePlayerLines("\n  \nMittfält\n")).toEqual([
      { shirtNumber: null, fullName: "Mittfält", squadGroup: null, sourceText: "Mittfält" },
    ]);
  });

  it("does not take a number in the middle as the shirt number", () => {
    expect(parsePlayerLines("Kalle 2 Ek")[0]).toMatchObject({ shirtNumber: null, fullName: "Kalle 2 Ek" });
  });
});
