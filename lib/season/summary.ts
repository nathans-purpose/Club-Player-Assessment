/**
 * Säsong: the season in numbers and the leaders' evaluation, as pure
 * functions. Rules follow the season evaluation template:
 *
 * - Points: win 3, draw 1, loss 0. A match without a score is not played yet.
 * - Area average: mean of the leaders who gave a score. Blank = can't judge.
 * - Disagreement: at least two scores and highest − lowest ≥ 3.
 * - Trained too little: number of leaders who answered "För lite".
 * - Prioritise: average below 6 and at least two leaders say it was trained too little.
 */

export type Venue = "home" | "away";
export type Half = "spring" | "autumn";
export type Training = "too_little" | "right" | "too_much";

export type Match = {
  id: string;
  round: number | null;
  playedOn: string | null;
  opponent: string;
  venue: Venue | null;
  half: Half | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  comment: string | null;
};

export type Outcome = "W" | "D" | "L";

export function outcome(match: Pick<Match, "goalsFor" | "goalsAgainst">): Outcome | null {
  if (match.goalsFor === null || match.goalsAgainst === null) return null;
  return match.goalsFor > match.goalsAgainst ? "W" : match.goalsFor === match.goalsAgainst ? "D" : "L";
}

export const POINTS: Record<Outcome, number> = { W: 3, D: 1, L: 0 };

export type MatchRecord = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  pointsPerMatch: number | null;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
};

export function matchRecord(matches: Pick<Match, "goalsFor" | "goalsAgainst">[]): MatchRecord {
  const r: MatchRecord = { played: 0, won: 0, drawn: 0, lost: 0, points: 0, pointsPerMatch: null, goalsFor: 0, goalsAgainst: 0, cleanSheets: 0 };
  for (const m of matches) {
    const o = outcome(m);
    if (!o) continue;
    r.played += 1;
    if (o === "W") r.won += 1;
    else if (o === "D") r.drawn += 1;
    else r.lost += 1;
    r.points += POINTS[o];
    r.goalsFor += m.goalsFor!;
    r.goalsAgainst += m.goalsAgainst!;
    if (m.goalsAgainst === 0) r.cleanSheets += 1;
  }
  r.pointsPerMatch = r.played ? r.points / r.played : null;
  return r;
}

export type Split = { key: "home" | "away" | "spring" | "autumn"; record: MatchRecord };

/** Home vs away and spring vs autumn. Splits without played matches are left out. */
export function splits(matches: Match[]): Split[] {
  const all: Split[] = [
    { key: "home", record: matchRecord(matches.filter((m) => m.venue === "home")) },
    { key: "away", record: matchRecord(matches.filter((m) => m.venue === "away")) },
    { key: "spring", record: matchRecord(matches.filter((m) => m.half === "spring")) },
    { key: "autumn", record: matchRecord(matches.filter((m) => m.half === "autumn")) },
  ];
  return all.filter((s) => s.record.played > 0);
}

/** Facts entered by hand: final position and totals for a season without a match log. */
export type SeasonReview = {
  finalPosition: number | null;
  manualMatches: number | null;
  manualPoints: number | null;
  manualGoalsFor: number | null;
  manualGoalsAgainst: number | null;
  goalSources: GoalSources;
};

export const EMPTY_REVIEW: SeasonReview = {
  finalPosition: null,
  manualMatches: null,
  manualPoints: null,
  manualGoalsFor: null,
  manualGoalsAgainst: null,
  goalSources: {},
};

export type SeasonTotals = {
  position: number | null;
  matches: number | null;
  points: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  fromMatchLog: boolean;
};

/** The season's headline numbers: from the match log, or the hand-entered totals when there is none. */
export function seasonTotals(matches: Match[], review: SeasonReview): SeasonTotals {
  const r = matchRecord(matches);
  if (r.played > 0) {
    return { position: review.finalPosition, matches: r.played, points: r.points, goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst, fromMatchLog: true };
  }
  return {
    position: review.finalPosition,
    matches: review.manualMatches,
    points: review.manualPoints,
    goalsFor: review.manualGoalsFor,
    goalsAgainst: review.manualGoalsAgainst,
    fromMatchLog: false,
  };
}

export type Comparison = { key: keyof Omit<SeasonTotals, "fromMatchLog">; previous: number | null; current: number | null; change: number | null };

/** This season against the previous one. For position, a negative change means places gained. */
export function compareTotals(previous: SeasonTotals, current: SeasonTotals): Comparison[] {
  return (["position", "matches", "points", "goalsFor", "goalsAgainst"] as const).map((key) => ({
    key,
    previous: previous[key],
    current: current[key],
    change: previous[key] !== null && current[key] !== null ? current[key]! - previous[key]! : null,
  }));
}

// ---------------------------------------------------------------------------
// How the goals came
// ---------------------------------------------------------------------------

export const GOAL_SOURCES = ["build_up", "transition", "set_piece", "penalty", "other"] as const;
export type GoalSource = (typeof GOAL_SOURCES)[number];
export type GoalSources = Partial<Record<GoalSource, { scored: number | null; conceded: number | null }>>;

export const GOAL_SOURCE_LABELS: Record<GoalSource, string> = {
  build_up: "Uppbyggt spel",
  transition: "Omställning",
  set_piece: "Fast situation",
  penalty: "Straff",
  other: "Misstag/övrigt",
};

/** Reads goal_sources from the database, dropping anything malformed. */
export function parseGoalSources(value: unknown): GoalSources {
  const out: GoalSources = {};
  if (!value || typeof value !== "object") return out;
  const count = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 999 ? v : null);
  for (const key of GOAL_SOURCES) {
    const row = (value as Record<string, unknown>)[key];
    if (!row || typeof row !== "object") continue;
    const scored = count((row as Record<string, unknown>).scored);
    const conceded = count((row as Record<string, unknown>).conceded);
    if (scored !== null || conceded !== null) out[key] = { scored, conceded };
  }
  return out;
}

export function goalSourceShares(sources: GoalSources) {
  const total = (k: "scored" | "conceded") => GOAL_SOURCES.reduce((sum, s) => sum + (sources[s]?.[k] ?? 0), 0);
  const scored = total("scored");
  const conceded = total("conceded");
  return {
    totals: { scored, conceded },
    rows: GOAL_SOURCES.map((key) => ({
      key,
      scored: sources[key]?.scored ?? null,
      conceded: sources[key]?.conceded ?? null,
      scoredShare: scored ? (sources[key]?.scored ?? 0) / scored : null,
      concededShare: conceded ? (sources[key]?.conceded ?? 0) / conceded : null,
    })),
  };
}

// ---------------------------------------------------------------------------
// The leaders' evaluation
// ---------------------------------------------------------------------------

export type Area = { id: string; groupName: string; name: string; question: string | null };

export type AreaRating = { areaId: string; score: number | null; training: Training | null; comment: string | null };

export type Evaluation = {
  leaderId: string;
  ratings: AreaRating[];
  strengths: string[];
  weaknesses: string[];
  outlookLevel: number | null;
  outlookPosition: number | null;
  outlookKeyFactor: string | null;
};

export type AreaSummary = {
  area: Area;
  average: number | null;
  min: number | null;
  max: number | null;
  spread: number | null;
  answers: number;
  disagree: boolean;
  tooLittle: number;
  prioritise: boolean;
  comments: { leaderId: string; text: string }[];
};

export const DISAGREEMENT_SPREAD = 3;
export const PRIORITISE_BELOW = 6;
export const PRIORITISE_MIN_TOO_LITTLE = 2;

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/** One row per area, from submitted evaluations only. */
export function summariseAreas(areas: Area[], evaluations: Evaluation[]): AreaSummary[] {
  return areas.map((area) => {
    const ratings = evaluations.flatMap((e) =>
      e.ratings.filter((r) => r.areaId === area.id).map((r) => ({ ...r, leaderId: e.leaderId })),
    );
    const scores = ratings.map((r) => r.score).filter((s): s is number => s !== null);
    const average = mean(scores);
    const min = scores.length ? Math.min(...scores) : null;
    const max = scores.length ? Math.max(...scores) : null;
    const spread = min !== null && max !== null ? max - min : null;
    const tooLittle = ratings.filter((r) => r.training === "too_little").length;
    return {
      area,
      average,
      min,
      max,
      spread,
      answers: scores.length,
      disagree: scores.length >= 2 && spread !== null && spread >= DISAGREEMENT_SPREAD,
      tooLittle,
      prioritise: average !== null && average < PRIORITISE_BELOW && tooLittle >= PRIORITISE_MIN_TOO_LITTLE,
      comments: ratings.filter((r) => r.comment?.trim()).map((r) => ({ leaderId: r.leaderId, text: r.comment!.trim() })),
    };
  });
}

/** Mean of the area averages per group, in the areas' order, plus all areas together. */
export function groupAverages(rows: AreaSummary[]): { group: string; average: number | null }[] {
  const groups: string[] = [];
  for (const r of rows) if (!groups.includes(r.area.groupName)) groups.push(r.area.groupName);
  const avgOf = (list: AreaSummary[]) => mean(list.map((r) => r.average).filter((a): a is number => a !== null));
  return groups.map((group) => ({ group, average: avgOf(rows.filter((r) => r.area.groupName === group)) }));
}

export function overallAverage(rows: AreaSummary[]): number | null {
  return mean(rows.map((r) => r.average).filter((a): a is number => a !== null));
}

/** The n strongest and weakest areas with an average. Ties keep the areas' order. */
export function strongestAndWeakest(rows: AreaSummary[], n = 3) {
  const rated = rows.filter((r) => r.average !== null);
  const strongest = [...rated].sort((a, b) => b.average! - a.average!).slice(0, n);
  const weakest = [...rated].sort((a, b) => a.average! - b.average!).slice(0, n);
  return { strongest, weakest };
}

export type OutlookSummary = {
  level: { average: number | null; min: number | null; max: number | null; answers: number };
  position: { average: number | null; min: number | null; max: number | null; answers: number };
  keyFactors: { leaderId: string; text: string }[];
};

export function summariseOutlook(evaluations: Evaluation[]): OutlookSummary {
  const stats = (values: (number | null)[]) => {
    const v = values.filter((x): x is number => x !== null);
    return { average: mean(v), min: v.length ? Math.min(...v) : null, max: v.length ? Math.max(...v) : null, answers: v.length };
  };
  return {
    level: stats(evaluations.map((e) => e.outlookLevel)),
    position: stats(evaluations.map((e) => e.outlookPosition)),
    keyFactors: evaluations
      .filter((e) => e.outlookKeyFactor?.trim())
      .map((e) => ({ leaderId: e.leaderId, text: e.outlookKeyFactor!.trim() })),
  };
}

/**
 * Areas to suggest as improvement priorities for the next season: those
 * marked "Prioritera?" first, then the weakest, at most `n`.
 */
export function suggestedPriorities(rows: AreaSummary[], n = 3): AreaSummary[] {
  const out: AreaSummary[] = [];
  const flagged = rows.filter((r) => r.prioritise).sort((a, b) => a.average! - b.average!);
  for (const r of [...flagged, ...strongestAndWeakest(rows, n).weakest]) {
    if (out.length >= n) break;
    if (!out.includes(r)) out.push(r);
  }
  return out;
}

/** Natural order of season labels: "2025" before "2026", "2025/26" before "2026/27". */
export function compareSeasonLabels(a: string, b: string): number {
  return a.localeCompare(b, "sv", { numeric: true });
}

/** The season just before the given one, by label. */
export function previousSeason<T extends { label: string }>(seasons: T[], current: T): T | null {
  const earlier = seasons.filter((s) => compareSeasonLabels(s.label, current.label) < 0);
  return earlier.sort((a, b) => compareSeasonLabels(a.label, b.label)).at(-1) ?? null;
}

/** A label for the season after this one: "2026" → "2027", "2026/27" → "2027/28". */
export function nextSeasonLabel(label: string): string {
  const split = /^(\d{4})\/(\d{2})$/.exec(label.trim());
  if (split) {
    const start = Number(split[1]) + 1;
    return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
  }
  const year = /^\d{4}$/.exec(label.trim());
  return year ? String(Number(label) + 1) : "";
}
