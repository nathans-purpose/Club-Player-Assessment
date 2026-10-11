import { POSITION_CODES, type PositionCode } from "@/lib/positions";

/**
 * Önskad trupp: the squad the leaders want for a season, per position,
 * against the current players and the recruitment wishlist.
 */

export const PLAYER_PLAN_STATUSES = ["key", "stays", "uncertain", "leaving"] as const;
export type PlayerPlanStatus = (typeof PLAYER_PLAN_STATUSES)[number];

export const PLAYER_PLAN_STATUS_LABELS: Record<PlayerPlanStatus, string> = {
  key: "Nyckelspelare",
  stays: "Stannar",
  uncertain: "Osäker",
  leaving: "Slutar",
};

export const RECRUITMENT_STATUSES = ["idea", "contacted", "talking", "signed", "declined"] as const;
export type RecruitmentStatus = (typeof RECRUITMENT_STATUSES)[number];

export const RECRUITMENT_STATUS_LABELS: Record<RecruitmentStatus, string> = {
  idea: "Idé",
  contacted: "Kontaktad",
  talking: "I samtal",
  signed: "Klar",
  declined: "Tackat nej",
};

export const PRIORITY_LABELS: Record<1 | 2 | 3, string> = { 1: "Hög", 2: "Mellan", 3: "Låg" };

export type PositionWish = { code: PositionCode; wanted: number; roleNote: string | null };
export type PlannedPlayer = { playerId: string; status: PlayerPlanStatus; position: PositionCode | null };
export type Recruit = { id: string; position: PositionCode | null; status: RecruitmentStatus };

export type PositionPlan = {
  code: PositionCode;
  wanted: number;
  roleNote: string | null;
  /** Key players and players who stay. */
  secure: string[];
  uncertain: string[];
  leaving: string[];
  /** Signed recruits count as secure. */
  signed: string[];
  /** Recruits still in progress (idé, kontaktad, i samtal). */
  inProgress: string[];
  /** wanted − (secure + signed); positive = players missing. */
  gap: number;
};

/**
 * One row per position that is wanted or has anyone planned there, in pitch
 * order. Players and recruits without a position are left out.
 */
export function planPositions(wishes: PositionWish[], players: PlannedPlayer[], recruits: Recruit[]): PositionPlan[] {
  const rows: PositionPlan[] = [];
  for (const code of POSITION_CODES) {
    const wish = wishes.find((w) => w.code === code);
    const here = players.filter((p) => p.position === code);
    const recruitsHere = recruits.filter((r) => r.position === code);
    const wanted = wish?.wanted ?? 0;
    if (wanted === 0 && here.length === 0 && recruitsHere.length === 0) continue;
    const secure = here.filter((p) => p.status === "key" || p.status === "stays").map((p) => p.playerId);
    const signed = recruitsHere.filter((r) => r.status === "signed").map((r) => r.id);
    rows.push({
      code,
      wanted,
      roleNote: wish?.roleNote ?? null,
      secure,
      uncertain: here.filter((p) => p.status === "uncertain").map((p) => p.playerId),
      leaving: here.filter((p) => p.status === "leaving").map((p) => p.playerId),
      signed,
      inProgress: recruitsHere
        .filter((r) => r.status === "idea" || r.status === "contacted" || r.status === "talking")
        .map((r) => r.id),
      gap: wanted - secure.length - signed.length,
    });
  }
  return rows;
}

export function squadTotals(rows: PositionPlan[]) {
  const sum = (f: (r: PositionPlan) => number) => rows.reduce((s, r) => s + f(r), 0);
  return {
    wanted: sum((r) => r.wanted),
    secure: sum((r) => r.secure.length + r.signed.length),
    uncertain: sum((r) => r.uncertain.length),
    missing: sum((r) => Math.max(0, r.gap)),
  };
}
