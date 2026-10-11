import { describe, expect, it } from "vitest";
import {
  type Area,
  compareTotals,
  type Evaluation,
  EMPTY_REVIEW,
  goalSourceShares,
  groupAverages,
  type Match,
  matchRecord,
  nextSeasonLabel,
  outcome,
  overallAverage,
  parseGoalSources,
  previousSeason,
  seasonTotals,
  splits,
  strongestAndWeakest,
  suggestedPriorities,
  summariseAreas,
  summariseOutlook,
} from "./summary";

const match = (gf: number | null, ga: number | null, extra: Partial<Match> = {}): Match => ({
  id: Math.random().toString(36),
  round: null,
  playedOn: null,
  opponent: "Testlag",
  venue: null,
  half: null,
  goalsFor: gf,
  goalsAgainst: ga,
  comment: null,
  ...extra,
});

describe("results", () => {
  it("scores outcomes and skips unplayed matches", () => {
    expect(outcome(match(2, 1))).toBe("W");
    expect(outcome(match(1, 1))).toBe("D");
    expect(outcome(match(0, 3))).toBe("L");
    expect(outcome(match(null, null))).toBeNull();
  });

  it("sums a record", () => {
    const r = matchRecord([match(2, 0), match(1, 1), match(0, 2), match(null, null)]);
    expect(r).toEqual({
      played: 3,
      won: 1,
      drawn: 1,
      lost: 1,
      points: 4,
      pointsPerMatch: 4 / 3,
      goalsFor: 3,
      goalsAgainst: 3,
      cleanSheets: 1,
    });
    expect(matchRecord([]).pointsPerMatch).toBeNull();
  });

  it("splits home/away and spring/autumn, leaving out empty splits", () => {
    const s = splits([match(1, 0, { venue: "home", half: "spring" }), match(0, 1, { venue: "away", half: "spring" })]);
    expect(s.map((x) => [x.key, x.record.points])).toEqual([
      ["home", 3],
      ["away", 0],
      ["spring", 3],
    ]);
  });

  it("uses the match log for totals, or the hand-entered numbers without one", () => {
    const review = { ...EMPTY_REVIEW, finalPosition: 4, manualMatches: 22, manualPoints: 30, manualGoalsFor: 40, manualGoalsAgainst: 35 };
    expect(seasonTotals([match(2, 1)], review)).toMatchObject({ position: 4, matches: 1, points: 3, fromMatchLog: true });
    expect(seasonTotals([match(null, null)], review)).toEqual({
      position: 4,
      matches: 22,
      points: 30,
      goalsFor: 40,
      goalsAgainst: 35,
      fromMatchLog: false,
    });
  });

  it("compares two seasons", () => {
    const prev = seasonTotals([], { ...EMPTY_REVIEW, finalPosition: 6, manualPoints: 30 });
    const cur = seasonTotals([match(3, 0)], { ...EMPTY_REVIEW, finalPosition: 4 });
    const cmp = compareTotals(prev, cur);
    expect(cmp.find((c) => c.key === "position")).toEqual({ key: "position", previous: 6, current: 4, change: -2 });
    expect(cmp.find((c) => c.key === "goalsFor")?.change).toBeNull();
  });
});

describe("goal sources", () => {
  it("keeps valid counts only", () => {
    expect(parseGoalSources({ build_up: { scored: 5, conceded: -1 }, nope: { scored: 1 }, penalty: "x" })).toEqual({
      build_up: { scored: 5, conceded: null },
    });
    expect(parseGoalSources(null)).toEqual({});
  });

  it("computes shares", () => {
    const s = goalSourceShares({ build_up: { scored: 3, conceded: 0 }, transition: { scored: 1, conceded: 2 } });
    expect(s.totals).toEqual({ scored: 4, conceded: 2 });
    expect(s.rows[0]).toMatchObject({ key: "build_up", scoredShare: 0.75, concededShare: 0 });
  });
});

const areas: Area[] = [
  { id: "a1", groupName: "Med boll", name: "Speluppbyggnad", question: null },
  { id: "a2", groupName: "Med boll", name: "Avslut", question: null },
  { id: "a3", groupName: "Utan boll", name: "Press", question: null },
  { id: "a4", groupName: "Utan boll", name: "Block", question: null },
];

const evaluation = (leaderId: string, scores: Record<string, number | null>, tooLittle: string[] = []): Evaluation => ({
  leaderId,
  ratings: Object.entries(scores).map(([areaId, score]) => ({
    areaId,
    score,
    training: tooLittle.includes(areaId) ? "too_little" : "right",
    comment: areaId === "a1" ? ` Kommentar ${leaderId} ` : null,
  })),
  strengths: [],
  weaknesses: [],
  outlookLevel: null,
  outlookPosition: null,
  outlookKeyFactor: null,
});

describe("area summary", () => {
  const evaluations = [
    evaluation("l1", { a1: 8, a2: 4, a3: 7, a4: null }, ["a2"]),
    evaluation("l2", { a1: 5, a2: 5, a3: 7 }, ["a2"]),
    evaluation("l3", { a1: 8, a2: 6 }),
  ];
  const rows = summariseAreas(areas, evaluations);

  it("averages over leaders who gave a score", () => {
    expect(rows.map((r) => [r.area.id, r.average, r.answers])).toEqual([
      ["a1", 7, 3],
      ["a2", 5, 3],
      ["a3", 7, 2],
      ["a4", null, 0],
    ]);
  });

  it("flags disagreement at a spread of 3 with at least two answers", () => {
    expect(rows.map((r) => r.disagree)).toEqual([true, false, false, false]);
    expect(summariseAreas(areas, [evaluation("l1", { a1: 1 })])[0].disagree).toBe(false);
  });

  it("flags priorities: average below 6 and at least two say too little training", () => {
    expect(rows.map((r) => [r.tooLittle, r.prioritise])).toEqual([
      [0, false],
      [2, true],
      [0, false],
      [0, false],
    ]);
  });

  it("collects trimmed comments", () => {
    expect(rows[0].comments.map((c) => c.text)).toEqual(["Kommentar l1", "Kommentar l2", "Kommentar l3"]);
  });

  it("averages groups and the whole", () => {
    expect(groupAverages(rows)).toEqual([
      { group: "Med boll", average: 6 },
      { group: "Utan boll", average: 7 },
    ]);
    expect(overallAverage(rows)).toBeCloseTo(19 / 3);
  });

  it("finds strongest and weakest, and suggests priorities flagged first", () => {
    const { strongest, weakest } = strongestAndWeakest(rows, 2);
    expect(strongest.map((r) => r.area.id)).toEqual(["a1", "a3"]);
    expect(weakest.map((r) => r.area.id)).toEqual(["a2", "a1"]);
    expect(suggestedPriorities(rows, 2).map((r) => r.area.id)).toEqual(["a2", "a1"]);
  });
});

describe("outlook", () => {
  it("summarises level, position and key factors", () => {
    const e = (level: number | null, pos: number | null, text: string | null): Evaluation => ({
      ...evaluation("x", {}),
      outlookLevel: level,
      outlookPosition: pos,
      outlookKeyFactor: text,
    });
    const s = summariseOutlook([e(6, 4, "Truppen"), e(8, null, " "), e(null, 2, null)]);
    expect(s.level).toEqual({ average: 7, min: 6, max: 8, answers: 2 });
    expect(s.position).toEqual({ average: 3, min: 2, max: 4, answers: 2 });
    expect(s.keyFactors.map((k) => k.text)).toEqual(["Truppen"]);
  });
});

describe("season labels", () => {
  it("finds the previous season by label", () => {
    const seasons = [{ label: "2026" }, { label: "2024" }, { label: "2025" }, { label: "2027" }];
    expect(previousSeason(seasons, seasons[0])?.label).toBe("2025");
    expect(previousSeason(seasons, seasons[1])).toBeNull();
  });

  it("suggests the next label", () => {
    expect(nextSeasonLabel("2026")).toBe("2027");
    expect(nextSeasonLabel("2026/27")).toBe("2027/28");
    expect(nextSeasonLabel("2099/00")).toBe("2100/01");
    expect(nextSeasonLabel("Vår")).toBe("");
  });
});
