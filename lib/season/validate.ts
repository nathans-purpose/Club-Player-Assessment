import { z } from "zod";
import { POSITION_CODES } from "@/lib/positions";
import { PLAYER_PLAN_STATUSES, RECRUITMENT_STATUSES } from "./squad";
import { GOAL_SOURCES } from "./summary";

// Input checks for Säsong's server actions. Text is trimmed; empty optional
// text becomes null. The database checks the same limits.

const text = (max: number) =>
  z
    .string()
    .max(max * 2)
    .transform((s) => s.trim())
    .pipe(z.string().max(max));
const optionalText = (max: number) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((s) => (s ?? "").trim())
    .pipe(z.string().max(max))
    .transform((s) => (s === "" ? null : s));
const int = (min: number, max: number) => z.number().int().min(min).max(max);
const optionalInt = (min: number, max: number) => int(min, max).nullable();
const uuid = z.string().uuid();
const position = z.enum(POSITION_CODES);

export const MAX_STRENGTHS = 3;

export const evaluationSchema = z.object({
  ratings: z
    .array(
      z.object({
        areaId: uuid,
        score: optionalInt(1, 10),
        training: z.enum(["too_little", "right", "too_much"]).nullable(),
        comment: optionalText(300),
      }),
    )
    .max(100),
  strengths: z.array(text(200)).max(MAX_STRENGTHS),
  weaknesses: z.array(text(200)).max(MAX_STRENGTHS),
  outlookLevel: optionalInt(1, 10),
  outlookPosition: optionalInt(1, 99),
  outlookKeyFactor: optionalText(500),
});
export type EvaluationInput = z.input<typeof evaluationSchema>;

export const matchSchema = z
  .object({
    id: uuid.nullable(),
    round: optionalInt(1, 99),
    playedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    opponent: text(80).pipe(z.string().min(1, "Skriv motståndaren.")),
    venue: z.enum(["home", "away"]).nullable(),
    half: z.enum(["spring", "autumn"]).nullable(),
    goalsFor: optionalInt(0, 99),
    goalsAgainst: optionalInt(0, 99),
    comment: optionalText(300),
  })
  .refine((m) => (m.goalsFor === null) === (m.goalsAgainst === null), {
    message: "Fyll i både gjorda och insläppta mål, eller inget av dem.",
  });
export type MatchInput = z.input<typeof matchSchema>;

const goalCount = optionalInt(0, 999);
export const reviewSchema = z.object({
  finalPosition: optionalInt(1, 99),
  manualMatches: optionalInt(0, 99),
  manualPoints: optionalInt(0, 300),
  manualGoalsFor: optionalInt(0, 999),
  manualGoalsAgainst: optionalInt(0, 999),
  goalSources: z.partialRecord(z.enum(GOAL_SOURCES), z.object({ scored: goalCount, conceded: goalCount })),
});
export type ReviewInput = z.input<typeof reviewSchema>;

export const planSchema = z.object({
  goal: optionalText(1000),
  strategy: optionalText(3000),
  formation: optionalText(100),
  keepDoing: optionalText(2000),
});
export type PlanInput = z.input<typeof planSchema>;

export const prioritySchema = z.object({
  id: uuid.nullable(),
  area: text(100).pipe(z.string().min(1, "Skriv vilket område det gäller.")),
  goal: optionalText(300),
  action: optionalText(300),
  owner: optionalText(100),
  followUp: optionalText(100),
});
export type PriorityInput = z.input<typeof prioritySchema>;

export const squadSchema = z.object({
  positions: z
    .array(z.object({ code: position, wanted: int(0, 9), roleNote: optionalText(200) }))
    .max(POSITION_CODES.length),
  players: z
    .array(
      z.object({
        playerId: uuid,
        status: z.enum(PLAYER_PLAN_STATUSES).nullable(),
        position: position.nullable(),
        note: optionalText(200),
      }),
    )
    .max(200),
});
export type SquadInput = z.input<typeof squadSchema>;

export const recruitSchema = z.object({
  id: uuid.nullable(),
  fullName: text(100).pipe(z.string().min(1, "Skriv spelarens namn.")),
  currentClub: optionalText(100),
  position: position.nullable(),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  status: z.enum(RECRUITMENT_STATUSES),
  note: optionalText(500),
});
export type RecruitInput = z.input<typeof recruitSchema>;

const OWN_MESSAGES = new Set([
  "Skriv motståndaren.",
  "Fyll i både gjorda och insläppta mål, eller inget av dem.",
  "Skriv vilket område det gäller.",
  "Skriv spelarens namn.",
]);

/** The first of our own error messages in a failed parse, or the fallback. */
export function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues.map((i) => i.message).find((m) => OWN_MESSAGES.has(m)) ?? fallback;
}
