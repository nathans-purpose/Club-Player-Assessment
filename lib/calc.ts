// Calculation rules (spec §5). This module is the single source of truth:
// every number the app shows about a player or the team comes from here, and
// "Så räknas det" describes exactly these rules. Pure functions only.

import { POSITION_CODES, type PositionCode, type PositionLevel } from "./positions";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export type Subcategory = { id: string; name: string; isActive: boolean };
export type Category = { id: string; name: string; isActive: boolean; subcategories: Subcategory[] };

export type ScoreRow = { categoryId: string; subcategoryId: string | null; score: number };

export const ATTENDANCE_VALUES = [95, 80, 55, 25] as const;
export type AttendanceValue = (typeof ATTENDANCE_VALUES)[number];

export type Assessment = {
  leaderId: string;
  status: "draft" | "submitted";
  scores: ScoreRow[];
  positions: { code: PositionCode; level: PositionLevel }[];
  /** Phases answered "Vet ej" have no row. */
  attendance: { phaseId: string; value: AttendanceValue }[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Drafts never count (rule 2). */
export function submittedOnly(assessments: readonly Assessment[]): Assessment[] {
  return assessments.filter((a) => a.status === "submitted");
}

export function activeSubcategories(category: Category): Subcategory[] {
  return category.subcategories.filter((s) => s.isActive);
}

/** A category is deepened when it has at least one active subcategory. */
export function isDeepened(category: Category): boolean {
  return activeSubcategories(category).length > 0;
}

// ---------------------------------------------------------------------------
// Rule 1: category score per leader
// ---------------------------------------------------------------------------

/**
 * One leader's score for a category: the score itself, or for a deepened
 * category the mean of that leader's scores on its active subcategories.
 * A leader who rated the category before it was deepened (or after it stopped
 * being deepened) keeps the score they gave, so no rating is lost.
 */
export function categoryScore(category: Category, scores: readonly ScoreRow[]): number | null {
  const own = scores.filter((s) => s.categoryId === category.id);
  const plain = own.find((s) => s.subcategoryId === null)?.score ?? null;

  if (isDeepened(category)) {
    const activeIds = new Set(activeSubcategories(category).map((s) => s.id));
    const sub = mean(own.filter((s) => s.subcategoryId !== null && activeIds.has(s.subcategoryId)).map((s) => s.score));
    return sub ?? plain;
  }
  return plain ?? mean(own.filter((s) => s.subcategoryId !== null).map((s) => s.score));
}

// ---------------------------------------------------------------------------
// Rules 2–4: averages and disagreement
// ---------------------------------------------------------------------------

/** Max − min between leaders at or above this flags "Oeniga – diskutera". */
export const DISAGREEMENT_SPREAD = 3;

export type LeaderScore = { leaderId: string; score: number };

export type ScoreSummary = {
  average: number | null;
  perLeader: LeaderScore[];
  /** max − min between leaders; null with fewer than two scores. */
  spread: number | null;
  disagreement: boolean;
};

function summarize(perLeader: LeaderScore[]): ScoreSummary {
  const values = perLeader.map((p) => p.score);
  const spread = values.length >= 2 ? Math.max(...values) - Math.min(...values) : null;
  return {
    average: mean(values),
    perLeader,
    spread,
    disagreement: spread !== null && spread >= DISAGREEMENT_SPREAD,
  };
}

export type CategorySummary = ScoreSummary & {
  categoryId: string;
  subcategories: (ScoreSummary & { subcategoryId: string })[];
};

/** Category average over leaders with a submitted assessment (rule 2). */
export function summarizeCategory(category: Category, assessments: readonly Assessment[]): CategorySummary {
  const submitted = submittedOnly(assessments);

  const perLeader: LeaderScore[] = [];
  for (const a of submitted) {
    const score = categoryScore(category, a.scores);
    if (score !== null) perLeader.push({ leaderId: a.leaderId, score });
  }

  const subcategories = activeSubcategories(category).map((sub) => {
    const scores: LeaderScore[] = [];
    for (const a of submitted) {
      const row = a.scores.find((s) => s.categoryId === category.id && s.subcategoryId === sub.id);
      if (row) scores.push({ leaderId: a.leaderId, score: row.score });
    }
    return { subcategoryId: sub.id, ...summarize(scores) };
  });

  const own = summarize(perLeader);
  return {
    categoryId: category.id,
    ...own,
    // Rule 4: a split verdict on any subcategory flags the category too.
    disagreement: own.disagreement || subcategories.some((s) => s.disagreement),
    subcategories,
  };
}

export const FEW_ASSESSMENTS_BELOW = 3;

/** Rule 12: fewer than 3 submitted assessments gives "få bedömningar". */
export function hasFewAssessments(submittedCount: number): boolean {
  return submittedCount < FEW_ASSESSMENTS_BELOW;
}

export type PlayerSummary = {
  categories: CategorySummary[];
  /** Rule 3: mean of the category averages. */
  totalAverage: number | null;
  submittedCount: number;
  fewAssessments: boolean;
  disagreement: boolean;
};

/** Everything about one player's ratings. Inactive categories are left out. */
export function summarizePlayer(categories: readonly Category[], assessments: readonly Assessment[]): PlayerSummary {
  const summaries = categories.filter((c) => c.isActive).map((c) => summarizeCategory(c, assessments));
  const submittedCount = submittedOnly(assessments).length;
  return {
    categories: summaries,
    totalAverage: mean(summaries.flatMap((s) => (s.average === null ? [] : [s.average]))),
    submittedCount,
    fewAssessments: hasFewAssessments(submittedCount),
    disagreement: summaries.some((s) => s.disagreement),
  };
}

// ---------------------------------------------------------------------------
// Rule 5: training attendance
// ---------------------------------------------------------------------------

export const ATTENDANCE_LABELS: Record<AttendanceValue, string> = {
  95: "Nästan alltid",
  80: "Ofta",
  55: "Ibland",
  25: "Sällan",
};

/** Attendance below this percentage is shown in a warning colour. */
export const LOW_ATTENDANCE_BELOW = 60;

export function isAttendanceValue(value: unknown): value is AttendanceValue {
  return (ATTENDANCE_VALUES as readonly unknown[]).includes(value);
}

/** Mean over the leaders who answered for the phase; "Vet ej" doesn't count. */
export function phaseAttendance(assessments: readonly Assessment[], phaseId: string): number | null {
  return mean(
    submittedOnly(assessments).flatMap((a) => a.attendance.filter((r) => r.phaseId === phaseId).map((r) => r.value)),
  );
}

export function isLowAttendance(percent: number | null): boolean {
  return percent !== null && percent < LOW_ATTENDANCE_BELOW;
}

// ---------------------------------------------------------------------------
// Rule 6: positions
// ---------------------------------------------------------------------------

export const POSITION_WEIGHTS: Record<PositionLevel, number> = { 3: 1, 2: 0.7, 1: 0.3 };

export type PositionSummary = {
  code: PositionCode;
  /** Leaders who chose the position. */
  count: number;
  /** Rounded mean of the chosen levels. */
  level: PositionLevel;
  /** Sum of the chosen levels; the highest sum is the main position. */
  sum: number;
};

/**
 * Positions chosen for one player, best first: by sum of levels, then by how
 * many leaders chose it, then in pitch order.
 */
export function summarizePositions(assessments: readonly Assessment[]): PositionSummary[] {
  const byCode = new Map<PositionCode, number[]>();
  for (const a of submittedOnly(assessments)) {
    for (const p of a.positions) byCode.set(p.code, [...(byCode.get(p.code) ?? []), p.level]);
  }
  return [...byCode.entries()]
    .map(([code, levels]) => ({
      code,
      count: levels.length,
      level: clamp(Math.round(mean(levels)!), 1, 3) as PositionLevel,
      sum: levels.reduce((s, l) => s + l, 0),
    }))
    .sort(
      (a, b) => b.sum - a.sum || b.count - a.count || POSITION_CODES.indexOf(a.code) - POSITION_CODES.indexOf(b.code),
    );
}

export function mainPosition(assessments: readonly Assessment[]): PositionCode | null {
  return summarizePositions(assessments)[0]?.code ?? null;
}

// ---------------------------------------------------------------------------
// Rules 7–9: the team pitch
// ---------------------------------------------------------------------------

/** A player's rounded level per position they can play (from rule 6). */
export type PlayerLevels = Partial<Record<PositionCode, PositionLevel>>;

export function levelsFromSummary(positions: readonly PositionSummary[]): PlayerLevels {
  return Object.fromEntries(positions.map((p) => [p.code, p.level]));
}

/** Keeps only the positions played at minLevel or better ("Naturlig" is 3). */
export function levelsAtLeast(levels: PlayerLevels, minLevel: PositionLevel): PlayerLevels {
  return Object.fromEntries(Object.entries(levels).filter(([, level]) => level >= minLevel));
}

export type Coverage = {
  /** Σ weight(level) over players who can play the position. */
  weighted: number;
  t: number;
  /** Players with level ≥ 2, shown as "2 av 3". */
  strongCount: number;
  target: number;
};

/** Rule 7, metric "Antal". */
export function positionCoverage(code: PositionCode, target: number, players: readonly PlayerLevels[]): Coverage {
  let weighted = 0;
  let strongCount = 0;
  for (const levels of players) {
    const level = levels[code];
    if (!level) continue;
    weighted += POSITION_WEIGHTS[level];
    if (level >= 2) strongCount++;
  }
  // A position without a target is covered as soon as anyone can play it.
  const t = target > 0 ? clamp(weighted / target, 0, 1) : weighted > 0 ? 1 : 0;
  return { weighted, t, strongCount, target };
}

/** Attribute averages map 5.5 → 0 and 8 → 1 on the colour scale. */
export function attributeT(average: number): number {
  return clamp((average - 5.5) / 2.5, 0, 1);
}

/**
 * Rule 8, attribute metrics (Teknik, …, Totalt): the weighted mean of the
 * attribute over players who can play the position.
 */
export function positionAttribute(
  code: PositionCode,
  players: readonly { levels: PlayerLevels; value: number | null }[],
): { average: number; t: number } | null {
  let total = 0;
  let weights = 0;
  for (const { levels, value } of players) {
    const level = levels[code];
    if (!level || value === null) continue;
    total += POSITION_WEIGHTS[level] * value;
    weights += POSITION_WEIGHTS[level];
  }
  if (weights === 0) return null;
  const average = total / weights;
  return { average, t: attributeT(average) };
}

export const SCALE_COLORS = { low: "#E5484D", mid: "#F5C524", high: "#A3F01A" } as const;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(from: string, to: string, amount: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return `#${a
    .map((c, i) => Math.round(c + (b[i] - c) * amount).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

/** Rule 9: red → yellow → lime. Always show the number next to the colour. */
export function scaleColor(t: number): string {
  const x = clamp(t, 0, 1);
  return x <= 0.5 ? mix(SCALE_COLORS.low, SCALE_COLORS.mid, x * 2) : mix(SCALE_COLORS.mid, SCALE_COLORS.high, (x - 0.5) * 2);
}

export function glows(t: number): boolean {
  return t > 0.85;
}

// ---------------------------------------------------------------------------
// Rule 10: radar
// ---------------------------------------------------------------------------

export const RADAR_MIN = 4;
export const RADAR_MAX = 9;

/** 0 at the centre (4), 1 at the edge (9). */
export function radarRadius(value: number): number {
  return clamp((value - RADAR_MIN) / (RADAR_MAX - RADAR_MIN), 0, 1);
}

/**
 * Category averages for a set of players: the mean of each player's category
 * average. Pass a squad group to compare one group with the whole team.
 */
export function groupCategoryAverages<G extends string>(
  players: readonly { squadGroup: G | null; categoryAverages: Record<string, number | null> }[],
  categoryIds: readonly string[],
  group: G | null = null,
): Record<string, number | null> {
  const selected = group === null ? players : players.filter((p) => p.squadGroup === group);
  return Object.fromEntries(
    categoryIds.map((id) => [
      id,
      mean(selected.flatMap((p) => (p.categoryAverages[id] == null ? [] : [p.categoryAverages[id]!]))),
    ]),
  );
}

// ---------------------------------------------------------------------------
// Rule 11: "Lag, bäst och svagast"
// ---------------------------------------------------------------------------

export const RATE_MIN_MATCHES = 5;

export type StatMetric =
  | "matches"
  | "goals"
  | "assists"
  | "yellowCards"
  | "goalsPerMatch"
  | "assistsPerMatch"
  | "yellowCardsPerMatch";

export type PlayerStats = {
  playerId: string;
  isGoalkeeper: boolean;
  matches: number | null;
  goals: number | null;
  assists: number | null;
  yellowCards: number | null;
};

const RATE_OF: Partial<Record<StatMetric, "goals" | "assists" | "yellowCards">> = {
  goalsPerMatch: "goals",
  assistsPerMatch: "assists",
  yellowCardsPerMatch: "yellowCards",
};

/**
 * A player's value for a stat metric, or null when the player doesn't count:
 * rates need at least 5 matches, and goals and assists leave out goalkeepers.
 */
export function statValue(stats: PlayerStats, metric: StatMetric): number | null {
  const base = RATE_OF[metric] ?? (metric as "matches" | "goals" | "assists" | "yellowCards");
  if ((base === "goals" || base === "assists") && stats.isGoalkeeper) return null;
  const value = stats[base];
  if (value === null) return null;
  if (RATE_OF[metric]) {
    if (stats.matches === null || stats.matches < RATE_MIN_MATCHES) return null;
    return value / stats.matches;
  }
  return value;
}

export type Extreme = { value: number; playerIds: string[] };

/**
 * Best and worst value with every tied player ("N spelare"). Values that are
 * null are left out. Pass higherIsBetter = false for e.g. yellow cards.
 */
export function bestAndWorst(
  values: readonly { playerId: string; value: number | null }[],
  higherIsBetter = true,
): { best: Extreme; worst: Extreme } | null {
  const present = values.filter((v): v is { playerId: string; value: number } => v.value !== null);
  if (present.length === 0) return null;
  const max = Math.max(...present.map((v) => v.value));
  const min = Math.min(...present.map((v) => v.value));
  const at = (target: number) => ({
    value: target,
    // Rates can differ in the last bits; treat them as equal.
    playerIds: present.filter((v) => Math.abs(v.value - target) < 1e-9).map((v) => v.playerId),
  });
  return higherIsBetter ? { best: at(max), worst: at(min) } : { best: at(min), worst: at(max) };
}

// ---------------------------------------------------------------------------
// Progress for one leader
// ---------------------------------------------------------------------------

/**
 * "X av N spelare bedömda": players this leader has submitted, counted once
 * each however many times they resubmit.
 */
export function leaderProgress(
  playerIds: readonly string[],
  submittedPlayerIds: Iterable<string>,
): { done: number; total: number } {
  const submitted = new Set(submittedPlayerIds);
  return { done: playerIds.filter((id) => submitted.has(id)).length, total: playerIds.length };
}

/** The next player in list order, after `currentId`, that isn't submitted yet. */
export function nextUnassessed(
  playerIds: readonly string[],
  currentId: string,
  submittedPlayerIds: Iterable<string>,
): string | null {
  const submitted = new Set(submittedPlayerIds);
  const start = playerIds.indexOf(currentId);
  for (let i = 1; i <= playerIds.length; i++) {
    const id = playerIds[(start + i + playerIds.length) % playerIds.length];
    if (id !== currentId && !submitted.has(id)) return id;
  }
  return null;
}
