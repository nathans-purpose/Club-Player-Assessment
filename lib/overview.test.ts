import { describe, expect, it } from "vitest";
import type { Assessment, Category } from "./calc";
import { buildOverview, isWaitingForAssessments, metricValue, type OverviewInput, sortPlayers } from "./overview";

const tek: Category = { id: "tek", name: "Teknik", isActive: true, subcategories: [] };
const fys: Category = { id: "fys", name: "Fysik", isActive: true, subcategories: [] };
const old: Category = { id: "old", name: "Nickar", isActive: false, subcategories: [] };

function scored(leaderId: string, tekScore: number, fysScore: number, partial: Partial<Assessment> = {}): Assessment {
  return {
    leaderId,
    status: "submitted",
    scores: [
      { categoryId: "tek", subcategoryId: null, score: tekScore },
      { categoryId: "fys", subcategoryId: null, score: fysScore },
    ],
    positions: [],
    attendance: [],
    ...partial,
  };
}

function input(partial: Partial<OverviewInput> = {}): OverviewInput {
  return {
    players: [
      { id: "keeper", shirtNumber: "1", fullName: "Kim Keeper", squadGroup: "MV" },
      { id: "back", shirtNumber: "2", fullName: "Bo Back", squadGroup: "FÖ" },
      { id: "nine", shirtNumber: "9", fullName: "Nils Nia", squadGroup: "AN" },
    ],
    categories: [tek, fys, old],
    phases: [
      { id: "pre", name: "Försäsong" },
      { id: "h1", name: "Första halvan" },
    ],
    targets: [
      { code: "MV", target: 1 },
      { code: "A", target: 2 },
    ],
    assessments: [
      { playerId: "keeper", assessment: scored("l1", 7, 6, { positions: [{ code: "MV", level: 3 }] }) },
      { playerId: "keeper", assessment: scored("l2", 8, 6, { positions: [{ code: "MV", level: 3 }] }) },
      {
        playerId: "nine",
        assessment: scored("l1", 9, 5, {
          positions: [{ code: "A", level: 3 }],
          attendance: [
            { phaseId: "pre", value: 95 },
            { phaseId: "h1", value: 25 },
          ],
        }),
      },
      { playerId: "nine", assessment: scored("l2", 5, 5, { positions: [{ code: "A", level: 2 }] }) },
      { playerId: "back", assessment: scored("l1", 6, 8, { positions: [{ code: "A", level: 1 }] }) },
      // Drafts never count.
      { playerId: "back", assessment: scored("l2", 1, 1, { status: "draft" }) },
    ],
    stats: [
      { playerId: "keeper", matches: 20, goals: 1, assists: 2, yellowCards: 0 },
      { playerId: "back", matches: 4, goals: 3, assists: 0, yellowCards: 2 },
      { playerId: "nine", matches: 10, goals: 8, assists: 3, yellowCards: 1 },
    ],
    leaderCount: 2,
    ...partial,
  };
}

describe("buildOverview", () => {
  const overview = buildOverview(input());
  const player = (id: string) => overview.players.find((p) => p.id === id)!;

  it("leaves inactive categories out", () => {
    expect(overview.categories.map((c) => c.id)).toEqual(["tek", "fys"]);
  });

  it("summarizes each player from submitted assessments only", () => {
    expect(player("back").submittedCount).toBe(1);
    expect(player("back").categoryAverages).toEqual({ tek: 6, fys: 8 });
    expect(player("keeper").totalAverage).toBe((7.5 + 6) / 2);
    expect(player("nine").disputedCategories).toEqual(["tek"]);
    expect(player("nine").mainPosition).toBe("A");
  });

  it("averages attendance over the phases that have a value", () => {
    expect(player("nine").attendance).toEqual({ pre: 95, h1: 25 });
    expect(player("nine").attendanceAverage).toBe(60);
    expect(player("keeper").attendanceAverage).toBeNull();
  });

  it("computes the KPI tiles", () => {
    expect(overview.kpis).toMatchObject({
      players: 3,
      submitted: 5,
      expected: 6,
      goals: 12,
      attendance: 60,
      disagreements: 1,
    });
  });

  it("shows only positions with a target on the pitch", () => {
    expect(overview.pitch.map((s) => s.code)).toEqual(["MV", "A"]);
  });

  it("covers positions with weighted levels (rule 7)", () => {
    const a = overview.pitch.find((s) => s.code === "A")!;
    // nine: mean level 2.5 rounds to 3 → 1.0; back: level 1 → 0.3
    expect(a.coverage.weighted).toBeCloseTo(1.3);
    expect(a.coverage.t).toBeCloseTo(0.65);
    expect(a.coverage.strongCount).toBe(1);
    expect(a.players).toEqual([
      { id: "nine", level: 3 },
      { id: "back", level: 1 },
    ]);
  });

  it("weights attributes by level (rule 8)", () => {
    const a = overview.pitch.find((s) => s.code === "A")!;
    // tek: nine 7 (weight 1), back 6 (weight 0.3)
    expect(a.attributes["category:tek"]!.average).toBeCloseTo((7 + 0.3 * 6) / 1.3);
  });

  it("narrows the pitch to natural players, or natural and funkar bra", () => {
    const at = (level: 1 | 2 | 3) => overview.pitchByLevel[level].find((s) => s.code === "A")!;
    expect(overview.pitchByLevel[1]).toEqual(overview.pitch);
    // back plays A at level 1 only, so both narrower pitches leave them out.
    for (const level of [2, 3] as const) {
      expect(at(level).players).toEqual([{ id: "nine", level: 3 }]);
      expect(at(level).coverage.weighted).toBeCloseTo(1);
      expect(at(level).coverage.strongCount).toBe(1);
      expect(at(level).attributes["category:tek"]!.average).toBeCloseTo(7);
    }
    expect(at(1).players).toHaveLength(2);
  });

  it("compares a squad group with the team on the radar", () => {
    expect(overview.radar.groups.MV).toEqual({ tek: 7.5, fys: 6 });
    expect(overview.radar.groups.MF).toEqual({ tek: null, fys: null });
    expect(overview.radar.team.fys).toBeCloseTo((6 + 8 + 5) / 3);
  });

  it("ranks stats by rule 11", () => {
    const ranking = (metric: string) => overview.rankings.find((r) => r.metric === metric)!;
    // The keeper's assist is left out; nine has the most.
    expect(ranking("assists").best).toEqual({ value: 3, playerIds: ["nine"] });
    expect(ranking("assists").worst).toEqual({ value: 0, playerIds: ["back"] });
    // Rates need 5 matches: back (4 matches) doesn't count.
    expect(ranking("goalsPerMatch").best).toEqual({ value: 0.8, playerIds: ["nine"] });
    expect(ranking("goalsPerMatch").team).toBeCloseTo(0.8);
    // Fewer cards is better.
    expect(ranking("yellowCardsPerMatch").best).toEqual({ value: 0, playerIds: ["keeper"] });
  });

  it("collects ties", () => {
    const fysRanking = overview.rankings.find((r) => r.metric === "category:fys")!;
    expect(fysRanking.worst).toEqual({ value: 5, playerIds: ["nine"] });
    const tied = buildOverview(
      input({
        assessments: [
          { playerId: "keeper", assessment: scored("l1", 7, 7) },
          { playerId: "back", assessment: scored("l1", 7, 7) },
        ],
      }),
    );
    expect(tied.rankings[0].best!.playerIds).toEqual(["keeper", "back"]);
  });

  it("lists facts", () => {
    expect(overview.facts.groupCounts).toEqual({ MV: 1, FÖ: 1, MF: 0, AN: 1 });
    expect(overview.facts.thinPositions).toEqual([{ code: "A", strongCount: 1, target: 2 }]);
    expect(overview.facts.fewAssessments).toBe(3);
    expect(overview.facts.mostDisputedCategory).toEqual({ id: "tek", players: 1 });
    expect(overview.facts.strongestCategory!.id).toBe("tek");
    expect(overview.facts.weakestCategory!.id).toBe("fys");
  });

  it("keeps raw counts for the table but ranked values for rankings", () => {
    expect(metricValue(player("keeper"), "goals")).toBe(1);
    expect(metricValue(player("keeper"), "goals", true)).toBeNull();
    expect(metricValue(player("back"), "goalsPerMatch")).toBe(0.75);
    expect(metricValue(player("back"), "goalsPerMatch", true)).toBeNull();
    expect(metricValue(player("nine"), "phase:h1")).toBe(25);
  });
});

describe("isWaitingForAssessments", () => {
  it("waits until a quarter of all assessments are in", () => {
    expect(isWaitingForAssessments(0, 0)).toBe(true);
    expect(isWaitingForAssessments(12, 88)).toBe(true);
    expect(isWaitingForAssessments(22, 88)).toBe(false);
  });
});

describe("sortPlayers", () => {
  const { players } = buildOverview(input());

  it("sorts by a metric with missing values last", () => {
    expect(sortPlayers(players, "attendance", true).map((p) => p.id)).toEqual(["nine", "back", "keeper"]);
    expect(sortPlayers(players, "total", true).map((p) => p.id)).toEqual(["back", "keeper", "nine"]);
    expect(sortPlayers(players, "total", false).map((p) => p.id)).toEqual(["nine", "keeper", "back"]);
  });

  it("sorts by name and number", () => {
    expect(sortPlayers(players, "name", false).map((p) => p.id)).toEqual(["back", "keeper", "nine"]);
    expect(sortPlayers(players, "number", true).map((p) => p.id)).toEqual(["nine", "back", "keeper"]);
  });
});
