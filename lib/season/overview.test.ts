import { describe, expect, it } from "vitest";
import { type PlanInput, planOverview, seasonsByTime } from "./overview";

describe("seasonsByTime", () => {
  const s = (label: string, isActive = false) => ({ label, isActive });

  it("splits around the active season", () => {
    const { current, upcoming, past } = seasonsByTime([s("2027"), s("2025"), s("2026", true), s("2028"), s("2024")]);
    expect(current?.label).toBe("2026");
    expect(upcoming.map((x) => x.label)).toEqual(["2027", "2028"]);
    expect(past.map((x) => x.label)).toEqual(["2025", "2024"]);
  });

  it("takes the latest season as now when none is active", () => {
    const { current, upcoming, past } = seasonsByTime([s("2025/26"), s("2026/27")]);
    expect(current?.label).toBe("2026/27");
    expect(upcoming).toEqual([]);
    expect(past.map((x) => x.label)).toEqual(["2025/26"]);
  });

  it("handles a team without seasons", () => {
    expect(seasonsByTime([])).toEqual({ current: null, upcoming: [], past: [] });
  });
});

describe("planOverview", () => {
  const empty: PlanInput = {
    plan: { goal: "", strategy: "", formation: "", keepDoing: "" },
    priorities: [],
    positions: [],
    players: [],
    targets: [],
  };

  it("has nothing done for an empty plan", () => {
    const o = planOverview(empty, ["p1", "p2"]);
    expect(o.done).toBe(0);
    expect(o.steps.every((step) => !step.done)).toBe(true);
    expect(o.squad.saved).toBe(false);
    expect(o.decided).toBe(0);
    expect(o.players).toBe(2);
  });

  it("counts the steps, gaps and recruits", () => {
    const o = planOverview(
      {
        plan: { goal: "Topp tre", strategy: "", formation: "4-3-3", keepDoing: "" },
        priorities: [{ area: "Speluppbyggnad", action: "Uppspel varje tisdag" }],
        positions: [
          { code: "MV", wanted: 2, roleNote: null },
          { code: "A", wanted: 3, roleNote: null },
        ],
        players: [
          { playerId: "p1", status: "key", position: "MV" },
          { playerId: "p2", status: "stays", position: "A" },
          { playerId: "p3", status: "leaving", position: "A" },
          { playerId: "gone", status: "stays", position: "A" },
        ],
        targets: [
          { id: "r1", position: "A", status: "signed", priority: 2 },
          { id: "r2", position: "A", status: "talking", priority: 1 },
          { id: "r3", position: "MV", status: "idea", priority: 3 },
          { id: "r4", position: null, status: "declined", priority: 1 },
        ],
      },
      ["p1", "p2", "p3"],
    );
    expect(o.steps).toEqual([
      { key: "strategy", done: true },
      { key: "priorities", done: true },
      { key: "squad", done: true },
      { key: "decisions", done: true },
      { key: "recruits", done: true },
    ]);
    expect(o.done).toBe(5);
    // MV: 2 wanted, 1 secure. A: 3 wanted, 1 stays + 1 signed. The player who left the team is ignored.
    expect(o.gaps).toEqual([
      { code: "MV", missing: 1, inProgress: 1 },
      { code: "A", missing: 1, inProgress: 1 },
    ]);
    expect(o.squad).toMatchObject({ wanted: 5, secure: 3, missing: 2, saved: true });
    expect(o.decided).toBe(3);
    expect(o.leaving).toBe(1);
    expect(o.recruits).toEqual({ inProgress: 2, signed: 1, declined: 1, highPriority: 1 });
  });

  it("needs every active player decided for the decisions step", () => {
    const o = planOverview({ ...empty, players: [{ playerId: "p1", status: "stays", position: null }] }, ["p1", "p2"]);
    expect(o.steps.find((s) => s.key === "decisions")?.done).toBe(false);
    expect(o.decided).toBe(1);
  });
});
