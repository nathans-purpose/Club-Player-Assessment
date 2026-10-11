import { describe, expect, it } from "vitest";
import { evaluationSchema, firstIssue, matchSchema, recruitSchema, reviewSchema } from "./validate";

const ID = "00000000-0000-4000-a000-000000000001";

describe("season input", () => {
  it("trims text and turns empty optional text into null", () => {
    const r = recruitSchema.parse({
      id: null,
      fullName: "  Extern Spelare ",
      currentClub: "  ",
      position: "A",
      priority: 1,
      status: "idea",
      note: null,
    });
    expect(r).toMatchObject({ fullName: "Extern Spelare", currentClub: null, note: null });
  });

  it("needs both scores or neither for a match, with a Swedish message", () => {
    const base = { id: null, round: 1, playedOn: null, opponent: "Testlag", venue: "home", half: null, comment: null };
    expect(matchSchema.safeParse({ ...base, goalsFor: 2, goalsAgainst: 1 }).success).toBe(true);
    expect(matchSchema.safeParse({ ...base, goalsFor: null, goalsAgainst: null }).success).toBe(true);
    const bad = matchSchema.safeParse({ ...base, goalsFor: 2, goalsAgainst: null });
    expect(bad.success).toBe(false);
    expect(firstIssue(bad.error!, "fel")).toBe("Fyll i både gjorda och insläppta mål, eller inget av dem.");
    const empty = matchSchema.safeParse({ ...base, opponent: "  ", goalsFor: null, goalsAgainst: null });
    expect(firstIssue(empty.error!, "fel")).toBe("Skriv motståndaren.");
  });

  it("limits evaluation scores and strengths", () => {
    const base = { ratings: [], strengths: [], weaknesses: [], outlookLevel: null, outlookPosition: null, outlookKeyFactor: null };
    expect(evaluationSchema.safeParse({ ...base, ratings: [{ areaId: ID, score: 11, training: null }] }).success).toBe(false);
    expect(evaluationSchema.safeParse({ ...base, strengths: ["a", "b", "c", "d"] }).success).toBe(false);
    expect(evaluationSchema.safeParse({ ...base, ratings: [{ areaId: ID, score: null, training: "too_little" }] }).success).toBe(true);
  });

  it("accepts partial goal sources and rejects unknown ones", () => {
    const base = { finalPosition: 3, manualMatches: null, manualPoints: null, manualGoalsFor: null, manualGoalsAgainst: null };
    expect(reviewSchema.safeParse({ ...base, goalSources: { penalty: { scored: 2, conceded: null } } }).success).toBe(true);
    expect(reviewSchema.safeParse({ ...base, goalSources: { lucky: { scored: 2, conceded: 0 } } }).success).toBe(false);
  });
});
