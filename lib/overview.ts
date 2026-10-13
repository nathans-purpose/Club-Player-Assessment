// The squad overview (Översikt): everything the overview shows, built from the
// raw rows with the rules in calc.ts. Pure functions only, and the result is
// plain data so it can be handed to client components as is.

import {
  type Assessment,
  bestAndWorst,
  type Category,
  type Coverage,
  type Extreme,
  groupCategoryAverages,
  isLowAttendance,
  mean,
  phaseAttendance,
  positionAttribute,
  positionCoverage,
  levelsAtLeast,
  type PlayerLevels,
  type StatMetric,
  statValue,
  submittedOnly,
  summarizePlayer,
  summarizePositions,
} from "./calc";
import { SQUAD_GROUPS, type SquadGroup } from "./players/squad-groups";
import { POSITION_CODES, POSITION_LEVELS, type PositionCode, type PositionLevel } from "./positions";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export type OverviewInput = {
  players: { id: string; shirtNumber: string | null; fullName: string; squadGroup: SquadGroup | null }[];
  /** All of the team's categories; inactive ones are left out of the overview. */
  categories: Category[];
  phases: { id: string; name: string }[];
  targets: { code: PositionCode; target: number }[];
  /** Assessments of the season. Drafts are ignored. */
  assessments: { playerId: string; assessment: Assessment }[];
  stats: {
    playerId: string;
    matches: number | null;
    goals: number | null;
    assists: number | null;
    yellowCards: number | null;
  }[];
  /** Members who can assess (admins and leaders). */
  leaderCount: number;
};

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export const STAT_METRICS = [
  "matches",
  "goals",
  "assists",
  "yellowCards",
  "goalsPerMatch",
  "assistsPerMatch",
  "yellowCardsPerMatch",
] as const satisfies readonly StatMetric[];

/**
 * Anything a player can be sorted or ranked by: the total, a category
 * (`category:<id>`), attendance over the season or one phase (`phase:<id>`),
 * or a stat.
 */
export type MetricKey = "total" | `category:${string}` | "attendance" | `phase:${string}` | StatMetric;

/** Fewer is better for cards; more is better for everything else. */
export function higherIsBetter(metric: MetricKey): boolean {
  return metric !== "yellowCards" && metric !== "yellowCardsPerMatch";
}

export function isStatMetric(metric: string): metric is StatMetric {
  return (STAT_METRICS as readonly string[]).includes(metric);
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export type OverviewPlayer = {
  id: string;
  shirtNumber: string | null;
  fullName: string;
  squadGroup: SquadGroup | null;
  submittedCount: number;
  fewAssessments: boolean;
  disagreement: boolean;
  /** Categories flagged "Oeniga – diskutera" for the player. */
  disputedCategories: string[];
  totalAverage: number | null;
  categoryAverages: Record<string, number | null>;
  /** Mean attendance per phase. */
  attendance: Record<string, number | null>;
  /** Mean of the phases that have a value. */
  attendanceAverage: number | null;
  mainPosition: PositionCode | null;
  positions: { code: PositionCode; level: PositionLevel; count: number }[];
  /** Raw counts as entered, and rates per match (null under 5 matches). */
  stats: Record<StatMetric, number | null>;
  /** Stats as they count in "Lag, bäst och svagast" (rule 11). */
  rankedStats: Record<StatMetric, number | null>;
};

function isGoalkeeper(squadGroup: SquadGroup | null, mainPosition: PositionCode | null): boolean {
  return squadGroup ? squadGroup === "MV" : mainPosition === "MV";
}

/**
 * A player's value for a metric. `ranked` applies rule 11 to stats (rates need
 * 5 matches, goals and assists leave out goalkeepers); the Data table shows
 * the raw counts.
 */
export function metricValue(player: OverviewPlayer, metric: MetricKey, ranked = false): number | null {
  if (metric === "total") return player.totalAverage;
  if (metric === "attendance") return player.attendanceAverage;
  if (metric.startsWith("category:")) return player.categoryAverages[metric.slice("category:".length)] ?? null;
  if (metric.startsWith("phase:")) return player.attendance[metric.slice("phase:".length)] ?? null;
  return (ranked ? player.rankedStats : player.stats)[metric as StatMetric] ?? null;
}

// ---------------------------------------------------------------------------
// The pitch
// ---------------------------------------------------------------------------

/** "count" is the metric "Antal"; "total" and category ids are attributes. */
export type PitchMetric = "count" | "total" | `category:${string}`;

export type PitchSpot = {
  code: PositionCode;
  coverage: Coverage;
  /** Rule 8 per attribute metric; null when nobody can play the position. */
  attributes: Record<string, { average: number; t: number } | null>;
  /** Players who can play the position, best fit first. */
  players: { id: string; level: PositionLevel }[];
};

// ---------------------------------------------------------------------------
// "Lag, bäst och svagast"
// ---------------------------------------------------------------------------

export type Ranking = {
  metric: MetricKey;
  /** Mean over the players who count for the metric. */
  team: number | null;
  best: Extreme | null;
  worst: Extreme | null;
};

// ---------------------------------------------------------------------------
// The whole overview
// ---------------------------------------------------------------------------

export type Overview = {
  categories: { id: string; name: string }[];
  phases: { id: string; name: string }[];
  players: OverviewPlayer[];
  kpis: {
    teamAverage: number | null;
    players: number;
    submitted: number;
    /** Players × leaders: every assessment the season can have. */
    expected: number;
    goals: number | null;
    attendance: number | null;
    /** Players with a split verdict on at least one category. */
    disagreements: number;
  };
  /** Too few assessments for charts to mean anything yet. */
  waiting: boolean;
  /** The pitch counting every player who can play a position ("Kan spela" and up). */
  pitch: PitchSpot[];
  /**
   * The pitch counting only players at a level or better, keyed by that level:
   * 3 is "Naturlig" only, 2 adds "Funkar bra", 1 is the same as pitch.
   */
  pitchByLevel: Record<PositionLevel, PitchSpot[]>;
  radar: { team: Record<string, number | null>; groups: Record<SquadGroup, Record<string, number | null>> };
  rankings: Ranking[];
  facts: {
    groupCounts: Record<SquadGroup, number>;
    withoutGroup: number;
    /** Positions with fewer good fits (level ≥ 2) than the target. */
    thinPositions: { code: PositionCode; strongCount: number; target: number }[];
    fewAssessments: number;
    lowAttendance: number;
    strongestCategory: { id: string; average: number } | null;
    weakestCategory: { id: string; average: number } | null;
    /** The category with the most players flagged "Oeniga – diskutera". */
    mostDisputedCategory: { id: string; players: number } | null;
  };
};

/** The overview shows charts once a quarter of all possible assessments are in. */
export const WAITING_SHARE = 0.25;

export function isWaitingForAssessments(submitted: number, expected: number): boolean {
  return submitted === 0 || submitted < expected * WAITING_SHARE;
}

export function buildOverview(input: OverviewInput): Overview {
  const activeCategories = input.categories.filter((c) => c.isActive);
  const categoryIds = activeCategories.map((c) => c.id);

  const byPlayer = new Map<string, Assessment[]>();
  for (const { playerId, assessment } of input.assessments) {
    if (assessment.status !== "submitted") continue;
    byPlayer.set(playerId, [...(byPlayer.get(playerId) ?? []), assessment]);
  }
  const statsByPlayer = new Map(input.stats.map((s) => [s.playerId, s]));

  const players: OverviewPlayer[] = input.players.map((p) => {
    const assessments = byPlayer.get(p.id) ?? [];
    const summary = summarizePlayer(input.categories, assessments);
    const positions = summarizePositions(assessments);
    const attendance = Object.fromEntries(input.phases.map((ph) => [ph.id, phaseAttendance(assessments, ph.id)]));
    const mainPosition = positions[0]?.code ?? null;
    const raw = statsByPlayer.get(p.id);
    const statInput = {
      playerId: p.id,
      isGoalkeeper: isGoalkeeper(p.squadGroup, mainPosition),
      matches: raw?.matches ?? null,
      goals: raw?.goals ?? null,
      assists: raw?.assists ?? null,
      yellowCards: raw?.yellowCards ?? null,
    };
    const rate = (value: number | null) =>
      value === null || statInput.matches === null || statInput.matches === 0 ? null : value / statInput.matches;

    return {
      ...p,
      submittedCount: summary.submittedCount,
      fewAssessments: summary.fewAssessments,
      disagreement: summary.disagreement,
      disputedCategories: summary.categories.filter((c) => c.disagreement).map((c) => c.categoryId),
      totalAverage: summary.totalAverage,
      categoryAverages: Object.fromEntries(summary.categories.map((c) => [c.categoryId, c.average])),
      attendance,
      attendanceAverage: mean(Object.values(attendance).filter((v): v is number => v !== null)),
      mainPosition,
      positions: positions.map(({ code, level, count }) => ({ code, level, count })),
      stats: {
        matches: statInput.matches,
        goals: statInput.goals,
        assists: statInput.assists,
        yellowCards: statInput.yellowCards,
        goalsPerMatch: rate(statInput.goals),
        assistsPerMatch: rate(statInput.assists),
        yellowCardsPerMatch: rate(statInput.yellowCards),
      },
      rankedStats: Object.fromEntries(STAT_METRICS.map((m) => [m, statValue(statInput, m)])) as Record<
        StatMetric,
        number | null
      >,
    };
  });

  const submitted = submittedOnly(input.assessments.map((a) => a.assessment)).length;
  const expected = input.players.length * input.leaderCount;
  const present = (values: (number | null)[]) => values.filter((v): v is number => v !== null);
  const goals = present(players.map((p) => p.stats.goals));

  // Pitch (rules 7–8), once per lowest level the pitch can be filtered to.
  const shown = POSITION_CODES.filter((code) => input.targets.some((t) => t.code === code));
  const buildPitch = (minLevel: PositionLevel): PitchSpot[] => {
    const levels: { id: string; levels: PlayerLevels; player: OverviewPlayer }[] = players.map((p) => ({
      id: p.id,
      levels: levelsAtLeast(Object.fromEntries(p.positions.map((x) => [x.code, x.level])) as PlayerLevels, minLevel),
      player: p,
    }));
    return shown.map((code) => {
      const target = input.targets.find((t) => t.code === code)!.target;
      const attribute = (value: (p: OverviewPlayer) => number | null) =>
        positionAttribute(
          code,
          levels.map((l) => ({ levels: l.levels, value: value(l.player) })),
        );
      return {
        code,
        coverage: positionCoverage(
          code,
          target,
          levels.map((l) => l.levels),
        ),
        attributes: {
          total: attribute((p) => p.totalAverage),
          ...Object.fromEntries(categoryIds.map((id) => [`category:${id}`, attribute((p) => p.categoryAverages[id])])),
        },
        players: levels
          .filter((l) => l.levels[code])
          .map((l) => ({ id: l.id, level: l.levels[code]! }))
          .sort((a, b) => b.level - a.level),
      };
    });
  };
  const pitchByLevel = Object.fromEntries(POSITION_LEVELS.map((level) => [level, buildPitch(level)])) as Record<
    PositionLevel,
    PitchSpot[]
  >;
  const pitch = pitchByLevel[1];

  // Radar (rule 10)
  const radarInput = players.map((p) => ({ squadGroup: p.squadGroup, categoryAverages: p.categoryAverages }));
  const radar = {
    team: groupCategoryAverages(radarInput, categoryIds),
    groups: Object.fromEntries(
      SQUAD_GROUPS.map((g) => [g, groupCategoryAverages(radarInput, categoryIds, g)]),
    ) as Record<SquadGroup, Record<string, number | null>>,
  };

  // "Lag, bäst och svagast" (rule 11)
  const rankingMetrics: MetricKey[] = [
    "total",
    ...categoryIds.map((id) => `category:${id}` as const),
    "attendance",
    "matches",
    "goals",
    "assists",
    "goalsPerMatch",
    "assistsPerMatch",
    "yellowCardsPerMatch",
  ];
  const rankings: Ranking[] = rankingMetrics.map((metric) => {
    const values = players.map((p) => ({ playerId: p.id, value: metricValue(p, metric, true) }));
    const extremes = bestAndWorst(values, higherIsBetter(metric));
    return {
      metric,
      team: mean(present(values.map((v) => v.value))),
      best: extremes?.best ?? null,
      worst: extremes?.worst ?? null,
    };
  });

  // Fakta
  const categoryTeam = activeCategories
    .map((c) => ({ id: c.id, average: radar.team[c.id] }))
    .filter((c): c is { id: string; average: number } => c.average !== null)
    .sort((a, b) => b.average - a.average);
  const disputes = activeCategories
    .map((c) => ({
      id: c.id,
      players: players.filter((p) => p.disputedCategories.includes(c.id)).length,
    }))
    .filter((c) => c.players > 0)
    .sort((a, b) => b.players - a.players);

  return {
    categories: activeCategories.map((c) => ({ id: c.id, name: c.name })),
    phases: input.phases,
    players,
    kpis: {
      teamAverage: mean(present(players.map((p) => p.totalAverage))),
      players: players.length,
      submitted,
      expected,
      goals: goals.length > 0 ? goals.reduce((s, g) => s + g, 0) : null,
      attendance: mean(present(players.map((p) => p.attendanceAverage))),
      disagreements: players.filter((p) => p.disagreement).length,
    },
    waiting: isWaitingForAssessments(submitted, expected),
    pitch,
    pitchByLevel,
    radar,
    rankings,
    facts: {
      groupCounts: Object.fromEntries(
        SQUAD_GROUPS.map((g) => [g, players.filter((p) => p.squadGroup === g).length]),
      ) as Record<SquadGroup, number>,
      withoutGroup: players.filter((p) => !p.squadGroup).length,
      thinPositions: pitch
        .filter((s) => s.coverage.strongCount < s.coverage.target)
        .map((s) => ({ code: s.code, strongCount: s.coverage.strongCount, target: s.coverage.target })),
      fewAssessments: players.filter((p) => p.fewAssessments).length,
      lowAttendance: players.filter((p) => isLowAttendance(p.attendanceAverage)).length,
      strongestCategory: categoryTeam[0] ?? null,
      weakestCategory: categoryTeam.length > 1 ? categoryTeam[categoryTeam.length - 1] : null,
      mostDisputedCategory: disputes[0] ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Sorting the Data table
// ---------------------------------------------------------------------------

export type SortKey = "name" | "number" | MetricKey;

/** Sorts a copy; players without a value always go last. */
export function sortPlayers(players: readonly OverviewPlayer[], key: SortKey, descending: boolean): OverviewPlayer[] {
  const number = (n: string | null) => (n && /^\d+$/.test(n) ? Number(n) : null);
  const valueOf = (p: OverviewPlayer): number | string | null =>
    key === "name" ? p.fullName : key === "number" ? number(p.shirtNumber) : metricValue(p, key);
  return [...players].sort((a, b) => {
    const va = valueOf(a);
    const vb = valueOf(b);
    if (va === null && vb === null) return a.fullName.localeCompare(b.fullName, "sv");
    if (va === null) return 1;
    if (vb === null) return -1;
    const order = typeof va === "string" ? va.localeCompare(vb as string, "sv") : va - (vb as number);
    return (descending ? -order : order) || a.fullName.localeCompare(b.fullName, "sv");
  });
}
