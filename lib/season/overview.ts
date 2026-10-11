import type { PositionCode } from "@/lib/positions";
import { type PlannedPlayer, planPositions, type PositionWish, type Recruit, squadTotals } from "./squad";
import { compareSeasonLabels } from "./summary";

/**
 * Säsong's overview: which season is now, which are ahead and which are
 * behind, and how far the plan for each coming season has got.
 */

export type SeasonsByTime<T> = { current: T | null; upcoming: T[]; past: T[] };

/**
 * The active season is "now"; seasons with a later label are coming, earlier
 * ones are behind. Without an active season, the latest season counts as now.
 * Upcoming oldest first (next season first), past newest first.
 */
export function seasonsByTime<T extends { label: string; isActive: boolean }>(seasons: T[]): SeasonsByTime<T> {
  const sorted = [...seasons].sort((a, b) => compareSeasonLabels(a.label, b.label));
  const current = sorted.find((s) => s.isActive) ?? sorted.at(-1) ?? null;
  if (!current) return { current: null, upcoming: [], past: [] };
  return {
    current,
    upcoming: sorted.filter((s) => compareSeasonLabels(s.label, current.label) > 0),
    past: sorted.filter((s) => compareSeasonLabels(s.label, current.label) < 0).reverse(),
  };
}

export type PlanInput = {
  plan: { goal: string; strategy: string; formation: string; keepDoing: string };
  priorities: { area: string; action: string }[];
  positions: PositionWish[];
  players: PlannedPlayer[];
  targets: (Recruit & { priority: 1 | 2 | 3 })[];
};

export type PlanStep = "strategy" | "priorities" | "squad" | "decisions" | "recruits";

export type PlanOverview = {
  /** Each planning step and whether it is done. */
  steps: { key: PlanStep; done: boolean }[];
  done: number;
  squad: ReturnType<typeof squadTotals> & { saved: boolean };
  /** Positions still short of players, in pitch order. */
  gaps: { code: PositionCode; missing: number; inProgress: number }[];
  /** Active players with a decision (key, stays, uncertain, leaving) out of all active players. */
  decided: number;
  players: number;
  leaving: number;
  recruits: { inProgress: number; signed: number; declined: number; highPriority: number };
};

export const MAX_PRIORITIES = 3;

/**
 * How far a season's plan has got. Only active players count: a planned
 * player who has since left the team is ignored, like in the squad editor.
 */
export function planOverview(input: PlanInput, activePlayerIds: string[]): PlanOverview {
  const active = new Set(activePlayerIds);
  const players = input.players.filter((p) => active.has(p.playerId));
  const rows = planPositions(input.positions, players, input.targets);
  const totals = squadTotals(rows);
  const saved = input.positions.some((p) => p.wanted > 0);
  const inProgress = input.targets.filter((r) => r.status === "idea" || r.status === "contacted" || r.status === "talking");
  const steps: PlanOverview["steps"] = [
    { key: "strategy", done: Boolean(input.plan.goal.trim() || input.plan.strategy.trim()) },
    { key: "priorities", done: input.priorities.some((p) => p.area.trim()) },
    { key: "squad", done: saved },
    { key: "decisions", done: activePlayerIds.length > 0 && players.length >= activePlayerIds.length },
    { key: "recruits", done: input.targets.length > 0 },
  ];
  return {
    steps,
    done: steps.filter((s) => s.done).length,
    squad: { ...totals, saved },
    gaps: rows.filter((r) => r.gap > 0).map((r) => ({ code: r.code, missing: r.gap, inProgress: r.inProgress.length })),
    decided: players.length,
    players: activePlayerIds.length,
    leaving: players.filter((p) => p.status === "leaving").length,
    recruits: {
      inProgress: inProgress.length,
      signed: input.targets.filter((r) => r.status === "signed").length,
      declined: input.targets.filter((r) => r.status === "declined").length,
      highPriority: inProgress.filter((r) => r.priority === 1).length,
    },
  };
}
