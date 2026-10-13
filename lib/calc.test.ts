import { describe, expect, it } from "vitest";
import {
  type Assessment,
  type Category,
  attributeT,
  bestAndWorst,
  categoryScore,
  glows,
  groupCategoryAverages,
  hasFewAssessments,
  isLowAttendance,
  leaderProgress,
  levelsAtLeast,
  levelsFromSummary,
  mainPosition,
  mean,
  nextUnassessed,
  phaseAttendance,
  positionAttribute,
  positionCoverage,
  radarRadius,
  scaleColor,
  statValue,
  summarizeCategory,
  summarizePlayer,
  summarizePositions,
} from "./calc";

const plain: Category = { id: "fys", name: "Fysik", isActive: true, subcategories: [] };
const deepened: Category = {
  id: "tek",
  name: "Teknik",
  isActive: true,
  subcategories: [
    { id: "pass", name: "Passningar", isActive: true },
    { id: "touch", name: "Första touch", isActive: true },
    { id: "old", name: "Nickar", isActive: false },
  ],
};

function assessment(leaderId: string, partial: Partial<Assessment> = {}): Assessment {
  return { leaderId, status: "submitted", scores: [], positions: [], attendance: [], ...partial };
}

describe("mean", () => {
  it("is null for no values", () => {
    expect(mean([])).toBeNull();
  });
  it("averages", () => {
    expect(mean([4, 5, 9])).toBe(6);
  });
});

describe("rule 1: category score per leader", () => {
  it("is the score for a plain category", () => {
    expect(categoryScore(plain, [{ categoryId: "fys", subcategoryId: null, score: 7 }])).toBe(7);
  });

  it("is the mean of the active subcategory scores for a deepened category", () => {
    const scores = [
      { categoryId: "tek", subcategoryId: "pass", score: 6 },
      { categoryId: "tek", subcategoryId: "touch", score: 9 },
      { categoryId: "tek", subcategoryId: "old", score: 1 },
    ];
    expect(categoryScore(deepened, scores)).toBe(7.5);
  });

  it("ignores other categories", () => {
    expect(categoryScore(plain, [{ categoryId: "tek", subcategoryId: null, score: 7 }])).toBeNull();
  });

  it("keeps a plain score given before the category was deepened", () => {
    expect(categoryScore(deepened, [{ categoryId: "tek", subcategoryId: null, score: 4 }])).toBe(4);
  });

  it("keeps subcategory scores after the category stopped being deepened", () => {
    const undeepened: Category = { ...deepened, subcategories: deepened.subcategories.map((s) => ({ ...s, isActive: false })) };
    const scores = [
      { categoryId: "tek", subcategoryId: "pass", score: 6 },
      { categoryId: "tek", subcategoryId: "touch", score: 8 },
    ];
    expect(categoryScore(undeepened, scores)).toBe(7);
  });
});

describe("rules 2 and 4: category average and disagreement", () => {
  it("averages over submitted assessments only", () => {
    const summary = summarizeCategory(plain, [
      assessment("a", { scores: [{ categoryId: "fys", subcategoryId: null, score: 6 }] }),
      assessment("b", { scores: [{ categoryId: "fys", subcategoryId: null, score: 8 }] }),
      assessment("c", { status: "draft", scores: [{ categoryId: "fys", subcategoryId: null, score: 1 }] }),
    ]);
    expect(summary.average).toBe(7);
    expect(summary.perLeader).toEqual([
      { leaderId: "a", score: 6 },
      { leaderId: "b", score: 8 },
    ]);
    expect(summary.spread).toBe(2);
    expect(summary.disagreement).toBe(false);
  });

  it("flags a spread of 3 or more", () => {
    const summary = summarizeCategory(plain, [
      assessment("a", { scores: [{ categoryId: "fys", subcategoryId: null, score: 5 }] }),
      assessment("b", { scores: [{ categoryId: "fys", subcategoryId: null, score: 8 }] }),
    ]);
    expect(summary.disagreement).toBe(true);
  });

  it("has no spread with a single leader", () => {
    const summary = summarizeCategory(plain, [
      assessment("a", { scores: [{ categoryId: "fys", subcategoryId: null, score: 5 }] }),
    ]);
    expect(summary.spread).toBeNull();
    expect(summary.disagreement).toBe(false);
  });

  it("flags the category when a subcategory is split even if the means agree", () => {
    // Leader a: pass 9, touch 5 → 7. Leader b: pass 5, touch 9 → 7.
    const summary = summarizeCategory(deepened, [
      assessment("a", {
        scores: [
          { categoryId: "tek", subcategoryId: "pass", score: 9 },
          { categoryId: "tek", subcategoryId: "touch", score: 5 },
        ],
      }),
      assessment("b", {
        scores: [
          { categoryId: "tek", subcategoryId: "pass", score: 5 },
          { categoryId: "tek", subcategoryId: "touch", score: 9 },
        ],
      }),
    ]);
    expect(summary.average).toBe(7);
    expect(summary.spread).toBe(0);
    expect(summary.disagreement).toBe(true);
    expect(summary.subcategories.map((s) => [s.subcategoryId, s.average, s.disagreement])).toEqual([
      ["pass", 7, true],
      ["touch", 7, true],
    ]);
  });

  it("is empty without submitted assessments", () => {
    const summary = summarizeCategory(plain, []);
    expect(summary.average).toBeNull();
    expect(summary.perLeader).toEqual([]);
  });
});

describe("rule 3 and 12: player summary", () => {
  const inactive: Category = { id: "gone", name: "Borttagen", isActive: false, subcategories: [] };
  const assessments = [
    assessment("a", {
      scores: [
        { categoryId: "fys", subcategoryId: null, score: 6 },
        { categoryId: "tek", subcategoryId: "pass", score: 8 },
        { categoryId: "tek", subcategoryId: "touch", score: 8 },
        { categoryId: "gone", subcategoryId: null, score: 1 },
      ],
    }),
    assessment("b", {
      scores: [
        { categoryId: "fys", subcategoryId: null, score: 8 },
        { categoryId: "tek", subcategoryId: "pass", score: 9 },
        { categoryId: "tek", subcategoryId: "touch", score: 9 },
      ],
    }),
  ];

  it("totals the category averages and skips inactive categories", () => {
    const summary = summarizePlayer([plain, deepened, inactive], assessments);
    expect(summary.categories.map((c) => [c.categoryId, c.average])).toEqual([
      ["fys", 7],
      ["tek", 8.5],
    ]);
    expect(summary.totalAverage).toBe(7.75);
    expect(summary.submittedCount).toBe(2);
    expect(summary.fewAssessments).toBe(true);
    expect(summary.disagreement).toBe(false);
  });

  it("totals only categories that have scores", () => {
    const summary = summarizePlayer([plain, { ...deepened, id: "unrated" }], assessments);
    expect(summary.totalAverage).toBe(7);
  });

  it("marks fewer than three submitted assessments", () => {
    expect(hasFewAssessments(0)).toBe(true);
    expect(hasFewAssessments(2)).toBe(true);
    expect(hasFewAssessments(3)).toBe(false);
  });
});

describe("rule 5: attendance", () => {
  it("averages over leaders who answered, ignoring Vet ej and drafts", () => {
    const assessments = [
      assessment("a", { attendance: [{ phaseId: "p1", value: 95 }] }),
      assessment("b", { attendance: [{ phaseId: "p1", value: 55 }] }),
      assessment("c", { attendance: [] }),
      assessment("d", { status: "draft", attendance: [{ phaseId: "p1", value: 25 }] }),
    ];
    expect(phaseAttendance(assessments, "p1")).toBe(75);
    expect(phaseAttendance(assessments, "p2")).toBeNull();
  });

  it("warns below 60 %", () => {
    expect(isLowAttendance(59.9)).toBe(true);
    expect(isLowAttendance(60)).toBe(false);
    expect(isLowAttendance(null)).toBe(false);
  });
});

describe("rule 6: positions", () => {
  const assessments = [
    assessment("a", { positions: [{ code: "CM", level: 3 }, { code: "OM", level: 2 }] }),
    assessment("b", { positions: [{ code: "CM", level: 2 }, { code: "OM", level: 3 }, { code: "DM", level: 1 }] }),
    assessment("c", { positions: [{ code: "OM", level: 2 }] }),
    assessment("d", { status: "draft", positions: [{ code: "A", level: 3 }] }),
  ];

  it("counts leaders and rounds the mean level", () => {
    expect(summarizePositions(assessments)).toEqual([
      { code: "OM", count: 3, level: 2, sum: 7 },
      { code: "CM", count: 2, level: 3, sum: 5 },
      { code: "DM", count: 1, level: 1, sum: 1 },
    ]);
  });

  it("picks the highest sum as the main position", () => {
    expect(mainPosition(assessments)).toBe("OM");
    expect(mainPosition([])).toBeNull();
  });

  it("breaks ties by number of leaders, then pitch order", () => {
    expect(
      mainPosition([
        assessment("a", { positions: [{ code: "A", level: 2 }, { code: "VB", level: 2 }] }),
      ]),
    ).toBe("VB");
    expect(
      mainPosition([
        assessment("a", { positions: [{ code: "A", level: 3 }] }),
        assessment("b", { positions: [{ code: "HY", level: 2 }] }),
        assessment("c", { positions: [{ code: "HY", level: 1 }] }),
      ]),
    ).toBe("HY");
  });
});

describe("rule 7: pitch metric Antal", () => {
  const players = [
    levelsFromSummary([{ code: "CM", count: 1, level: 3, sum: 3 }]),
    { CM: 2 as const },
    { CM: 1 as const, OM: 3 as const },
    {},
  ];

  it("sums weights and compares with the target", () => {
    const coverage = positionCoverage("CM", 2, players);
    expect(coverage.weighted).toBeCloseTo(2.0);
    expect(coverage.t).toBe(1);
    expect(coverage.strongCount).toBe(2);
  });

  it("clamps to 0–1", () => {
    expect(positionCoverage("OM", 3, players).t).toBeCloseTo(1 / 3);
    expect(positionCoverage("A", 1, players).t).toBe(0);
  });

  it("handles a position without a target", () => {
    expect(positionCoverage("OM", 0, players).t).toBe(1);
    expect(positionCoverage("A", 0, players).t).toBe(0);
  });
});

describe("filtering the pitch by level", () => {
  const levels = { CM: 3 as const, OM: 2 as const, A: 1 as const };

  it("keeps positions at the level or better", () => {
    expect(levelsAtLeast(levels, 1)).toEqual(levels);
    expect(levelsAtLeast(levels, 2)).toEqual({ CM: 3, OM: 2 });
    expect(levelsAtLeast(levels, 3)).toEqual({ CM: 3 });
  });

  it("counts only natural players when filtered to Naturlig", () => {
    const players = [{ CM: 3 as const }, { CM: 2 as const }, { CM: 1 as const }].map((l) => levelsAtLeast(l, 3));
    expect(positionCoverage("CM", 2, players)).toMatchObject({ weighted: 1, strongCount: 1, t: 0.5 });
  });
});

describe("rule 8: pitch attribute metrics", () => {
  it("weights each player's value by their level", () => {
    const result = positionAttribute("CM", [
      { levels: { CM: 3 }, value: 8 },
      { levels: { CM: 1 }, value: 5 },
      { levels: { OM: 3 }, value: 1 },
      { levels: { CM: 2 }, value: null },
    ]);
    // (1·8 + 0.3·5) / 1.3
    expect(result!.average).toBeCloseTo(9.5 / 1.3);
    expect(result!.t).toBeCloseTo((9.5 / 1.3 - 5.5) / 2.5);
  });

  it("is null when nobody can play there", () => {
    expect(positionAttribute("A", [{ levels: { CM: 3 }, value: 8 }])).toBeNull();
  });

  it("maps 5.5 to 0 and 8 to 1", () => {
    expect(attributeT(5.5)).toBe(0);
    expect(attributeT(4)).toBe(0);
    expect(attributeT(6.75)).toBe(0.5);
    expect(attributeT(8)).toBe(1);
    expect(attributeT(9.5)).toBe(1);
  });
});

describe("rule 9: colour scale", () => {
  it("runs red → yellow → lime", () => {
    expect(scaleColor(0)).toBe("#E5484D");
    expect(scaleColor(0.5)).toBe("#F5C524");
    expect(scaleColor(1)).toBe("#A3F01A");
    expect(scaleColor(-1)).toBe("#E5484D");
    expect(scaleColor(0.25)).toBe("#ED8739");
  });

  it("glows above 0.85", () => {
    expect(glows(0.85)).toBe(false);
    expect(glows(0.86)).toBe(true);
  });
});

describe("rule 10: radar", () => {
  it("scales 4 → centre and 9 → edge", () => {
    expect(radarRadius(4)).toBe(0);
    expect(radarRadius(6.5)).toBe(0.5);
    expect(radarRadius(9)).toBe(1);
    expect(radarRadius(2)).toBe(0);
    expect(radarRadius(10)).toBe(1);
  });

  it("averages players' category averages for the team or one group", () => {
    const players: { squadGroup: "MF" | "AN" | null; categoryAverages: Record<string, number | null> }[] = [
      { squadGroup: "MF", categoryAverages: { tek: 8, fys: 6 } },
      { squadGroup: "AN", categoryAverages: { tek: 6, fys: null } },
      { squadGroup: null, categoryAverages: { tek: 7 } },
    ];
    expect(groupCategoryAverages(players, ["tek", "fys"])).toEqual({ tek: 7, fys: 6 });
    expect(groupCategoryAverages(players, ["tek", "fys"], "AN")).toEqual({ tek: 6, fys: null });
  });
});

describe("rule 11: Lag, bäst och svagast", () => {
  const stats = (partial: Partial<Parameters<typeof statValue>[0]>) => ({
    playerId: "p",
    isGoalkeeper: false,
    matches: 10,
    goals: 4,
    assists: 2,
    yellowCards: 1,
    ...partial,
  });

  it("computes rates per match", () => {
    expect(statValue(stats({}), "goalsPerMatch")).toBe(0.4);
    expect(statValue(stats({}), "yellowCardsPerMatch")).toBe(0.1);
    expect(statValue(stats({}), "goals")).toBe(4);
  });

  it("needs at least 5 matches for rates", () => {
    expect(statValue(stats({ matches: 4 }), "goalsPerMatch")).toBeNull();
    expect(statValue(stats({ matches: 5 }), "goalsPerMatch")).toBe(0.8);
    expect(statValue(stats({ matches: null }), "assistsPerMatch")).toBeNull();
    expect(statValue(stats({ matches: 4 }), "goals")).toBe(4);
  });

  it("leaves goalkeepers out of goals and assists", () => {
    const keeper = stats({ isGoalkeeper: true });
    expect(statValue(keeper, "goals")).toBeNull();
    expect(statValue(keeper, "assistsPerMatch")).toBeNull();
    expect(statValue(keeper, "yellowCards")).toBe(1);
  });

  it("returns every tied player", () => {
    const result = bestAndWorst([
      { playerId: "a", value: 3 },
      { playerId: "b", value: 5 },
      { playerId: "c", value: 5 },
      { playerId: "d", value: null },
    ]);
    expect(result).toEqual({ best: { value: 5, playerIds: ["b", "c"] }, worst: { value: 3, playerIds: ["a"] } });
  });

  it("can treat lower as better", () => {
    const result = bestAndWorst(
      [
        { playerId: "a", value: 0.1 },
        { playerId: "b", value: 0.3 },
      ],
      false,
    );
    expect(result!.best.playerIds).toEqual(["a"]);
    expect(result!.worst.playerIds).toEqual(["b"]);
  });

  it("treats rates that differ only by rounding as ties", () => {
    const result = bestAndWorst([
      { playerId: "a", value: 0.1 + 0.2 },
      { playerId: "b", value: 0.3 },
    ]);
    expect(result!.best.playerIds).toEqual(["a", "b"]);
  });

  it("is null without values", () => {
    expect(bestAndWorst([{ playerId: "a", value: null }])).toBeNull();
  });
});

describe("leader progress", () => {
  const ids = ["p1", "p2", "p3", "p4"];

  it("counts each submitted player once", () => {
    expect(leaderProgress(ids, ["p1", "p3", "p3", "gone"])).toEqual({ done: 2, total: 4 });
  });

  it("finds the next unassessed player, wrapping around", () => {
    expect(nextUnassessed(ids, "p1", ["p1", "p2"])).toBe("p3");
    expect(nextUnassessed(ids, "p4", ["p4", "p3"])).toBe("p1");
    expect(nextUnassessed(ids, "p2", ids)).toBeNull();
    expect(nextUnassessed(ids, "p2", ["p1", "p3", "p4"])).toBeNull();
  });
});
