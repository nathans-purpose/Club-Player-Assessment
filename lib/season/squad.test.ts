import { describe, expect, it } from "vitest";
import { planPositions, squadTotals } from "./squad";

describe("squad plan", () => {
  const rows = planPositions(
    [
      { code: "MV", wanted: 2, roleNote: "En etta och en utmanare" },
      { code: "A", wanted: 3, roleNote: null },
      { code: "VB", wanted: 0, roleNote: null },
    ],
    [
      { playerId: "p1", status: "key", position: "MV" },
      { playerId: "p2", status: "uncertain", position: "MV" },
      { playerId: "p3", status: "stays", position: "A" },
      { playerId: "p4", status: "leaving", position: "A" },
      { playerId: "p5", status: "stays", position: "CM" },
      { playerId: "p6", status: "stays", position: null },
    ],
    [
      { id: "r1", position: "A", status: "signed" },
      { id: "r2", position: "A", status: "talking" },
      { id: "r3", position: "A", status: "declined" },
    ],
  );

  it("lists wanted positions and positions with anyone planned, in pitch order", () => {
    expect(rows.map((r) => r.code)).toEqual(["MV", "CM", "A"]);
  });

  it("counts secure players and signed recruits against the wish", () => {
    const mv = rows.find((r) => r.code === "MV")!;
    expect(mv).toMatchObject({ secure: ["p1"], uncertain: ["p2"], gap: 1 });
    const a = rows.find((r) => r.code === "A")!;
    expect(a).toMatchObject({ secure: ["p3"], leaving: ["p4"], signed: ["r1"], inProgress: ["r2"], gap: 1 });
    expect(rows.find((r) => r.code === "CM")!.gap).toBe(-1);
  });

  it("sums the squad", () => {
    expect(squadTotals(rows)).toEqual({ wanted: 5, secure: 4, uncertain: 1, missing: 2 });
  });
});
