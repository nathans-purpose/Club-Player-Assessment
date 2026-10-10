// The Spelarkort form: its state in the browser, what is still missing before
// it can be submitted, and the payload the server action receives.

import { type AttendanceValue, isAttendanceValue } from "../calc";
import { type PositionCode, type PositionLevel, isPositionCode, isPositionLevel } from "../positions";

/** Active categories and subcategories, in form order. */
export type FormCategory = {
  id: string;
  name: string;
  question: string | null;
  subcategories: { id: string; name: string }[];
};

export type FormState = {
  positions: Partial<Record<PositionCode, PositionLevel>>;
  /** Keyed by scoreKey(categoryId, subcategoryId). */
  scores: Record<string, number>;
  /** Keyed by phase id; a missing phase is "Vet ej". */
  attendance: Record<string, AttendanceValue>;
  comment: string;
};

export type Payload = {
  comment: string;
  scores: { categoryId: string; subcategoryId: string | null; score: number }[];
  positions: { code: PositionCode; level: PositionLevel }[];
  attendance: { phaseId: string; value: AttendanceValue }[];
};

export const MAX_COMMENT_LENGTH = 2000;

export function scoreKey(categoryId: string, subcategoryId: string | null = null): string {
  return subcategoryId ? `${categoryId}:${subcategoryId}` : categoryId;
}

/** The items a leader must answer, in form order (positions, then ratings). */
export type RequiredItem = { kind: "positions"; id: "positions" } | { kind: "score"; id: string };

export function requiredItems(categories: readonly FormCategory[]): RequiredItem[] {
  return [
    { kind: "positions", id: "positions" },
    ...categories.flatMap((c) =>
      c.subcategories.length > 0
        ? c.subcategories.map((s) => ({ kind: "score" as const, id: scoreKey(c.id, s.id) }))
        : [{ kind: "score" as const, id: scoreKey(c.id) }],
    ),
  ];
}

/** Unanswered required items, first one first. Attendance and comment are optional. */
export function missingItems(state: FormState, categories: readonly FormCategory[]): RequiredItem[] {
  return requiredItems(categories).filter((item) =>
    item.kind === "positions" ? Object.keys(state.positions).length === 0 : state.scores[item.id] === undefined,
  );
}

/** Only answers to the current form go to the server. */
export function toPayload(state: FormState, categories: readonly FormCategory[]): Payload {
  const scores: Payload["scores"] = [];
  for (const c of categories) {
    const keys = c.subcategories.length > 0 ? c.subcategories.map((s) => [s.id, scoreKey(c.id, s.id)] as const) : [[null, c.id] as const];
    for (const [subcategoryId, key] of keys) {
      const score = state.scores[key];
      if (score !== undefined) scores.push({ categoryId: c.id, subcategoryId, score });
    }
  }
  return {
    comment: state.comment,
    scores,
    positions: Object.entries(state.positions).map(([code, level]) => ({
      code: code as PositionCode,
      level: level as PositionLevel,
    })),
    attendance: Object.entries(state.attendance).map(([phaseId, value]) => ({ phaseId, value })),
  };
}

/** The form state for answers already saved. */
export function fromPayload(payload: Payload): FormState {
  return {
    comment: payload.comment,
    scores: Object.fromEntries(payload.scores.map((s) => [scoreKey(s.categoryId, s.subcategoryId), s.score])),
    positions: Object.fromEntries(payload.positions.map((p) => [p.code, p.level])),
    attendance: Object.fromEntries(payload.attendance.map((a) => [a.phaseId, a.value])),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
const isScore = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 10;

/**
 * Checks a payload from the browser. Returns null when anything is malformed;
 * the database checks that the ids belong to the player's team.
 */
export function parsePayload(input: unknown): Payload | null {
  if (typeof input !== "object" || input === null) return null;
  const { comment, scores, positions, attendance } = input as Record<string, unknown>;
  if (typeof comment !== "string" || comment.length > MAX_COMMENT_LENGTH) return null;
  if (!Array.isArray(scores) || !Array.isArray(positions) || !Array.isArray(attendance)) return null;
  if (scores.length > 500 || positions.length > 13 || attendance.length > 50) return null;

  const validScores = scores.every(
    (s) => isUuid(s?.categoryId) && (s.subcategoryId === null || isUuid(s.subcategoryId)) && isScore(s.score),
  );
  const validPositions = positions.every((p) => isPositionCode(p?.code) && isPositionLevel(p.level));
  const validAttendance = attendance.every((a) => isUuid(a?.phaseId) && isAttendanceValue(a.value));
  if (!validScores || !validPositions || !validAttendance) return null;

  const unique = (keys: string[]) => new Set(keys).size === keys.length;
  if (
    !unique(scores.map((s) => scoreKey(s.categoryId, s.subcategoryId))) ||
    !unique(positions.map((p) => p.code)) ||
    !unique(attendance.map((a) => a.phaseId))
  ) {
    return null;
  }

  return {
    comment,
    scores: scores.map((s) => ({ categoryId: s.categoryId, subcategoryId: s.subcategoryId, score: s.score })),
    positions: positions.map((p) => ({ code: p.code, level: p.level })),
    attendance: attendance.map((a) => ({ phaseId: a.phaseId, value: a.value })),
  };
}
