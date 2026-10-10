// Positioner på planen: which positions the team's pitch shows, how many
// players the team needs on each, and formation presets.

import { DEFAULT_FORMATIONS, type PositionTarget } from "@/lib/onboarding/defaults";
import { isPositionCode, POSITION_CODES, type PositionCode } from "@/lib/positions";

export type Targets = Partial<Record<PositionCode, number>>;

export const MAX_TARGET = 5;

export type FormationPreset = { id: string; name: string; targets: Targets };

function toTargets(rows: readonly PositionTarget[]): Targets {
  return Object.fromEntries(rows.map((r) => [r.position_code, r.target_count]));
}

// The position codes have two centre-back spots, so the third centre-back in
// 3-5-2 counts on Vänster mittback.
export const FORMATION_PRESETS: FormationPreset[] = [
  { id: "4-4-2", name: "4-4-2", targets: toTargets(DEFAULT_FORMATIONS[11].targets) },
  {
    id: "4-3-3",
    name: "4-3-3",
    targets: { MV: 1, VB: 1, VMB: 1, HMB: 1, HB: 1, DM: 1, CM: 2, VY: 1, HY: 1, A: 1 },
  },
  {
    id: "4-2-3-1",
    name: "4-2-3-1",
    targets: { MV: 1, VB: 1, VMB: 1, HMB: 1, HB: 1, DM: 2, VY: 1, OM: 1, HY: 1, A: 1 },
  },
  {
    id: "3-5-2",
    name: "3-5-2",
    targets: { MV: 1, VMB: 2, HMB: 1, VM: 1, CM: 2, HM: 1, OM: 1, A: 2 },
  },
  { id: "7-mot-7", name: "7 mot 7", targets: toTargets(DEFAULT_FORMATIONS[7].targets) },
];

/** Players on the pitch for a set of targets. */
export function targetTotal(targets: Targets): number {
  return Object.values(targets).reduce<number>((sum, n) => sum + (n ?? 0), 0);
}

/** The preset these targets match exactly, if any. */
export function matchingPreset(targets: Targets): FormationPreset | null {
  const same = (a: Targets, b: Targets) =>
    POSITION_CODES.every((code) => (a[code] ?? null) === (b[code] ?? null));
  return FORMATION_PRESETS.find((p) => same(p.targets, targets)) ?? null;
}

/** Shows a hidden position with a target of 1, or hides a shown one. */
export function togglePosition(targets: Targets, code: PositionCode): Targets {
  const next = { ...targets };
  if (next[code] === undefined) next[code] = 1;
  else delete next[code];
  return next;
}

export function setTarget(targets: Targets, code: PositionCode, count: number): Targets {
  if (targets[code] === undefined) return targets;
  return { ...targets, [code]: Math.min(MAX_TARGET, Math.max(0, Math.round(count))) };
}

export type TargetsResult =
  | { ok: true; rows: { position_code: PositionCode; target_count: number }[] }
  | { ok: false; message: string };

/** Checks what the admin wants to save; rows come out in pitch order. */
export function validateTargets(input: unknown): TargetsResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, message: "Positionerna kunde inte läsas. Försök igen." };
  }
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.some(([code]) => !isPositionCode(code))) {
    return { ok: false, message: "Positionerna kunde inte läsas. Försök igen." };
  }
  if (
    entries.some(([, n]) => typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > MAX_TARGET)
  ) {
    return { ok: false, message: `Antalet per position ska vara 0–${MAX_TARGET}.` };
  }
  if (entries.length === 0) return { ok: false, message: "Visa minst en position på planen." };
  const targets = input as Targets;
  return {
    ok: true,
    rows: POSITION_CODES.filter((code) => targets[code] !== undefined).map((code) => ({
      position_code: code,
      target_count: targets[code]!,
    })),
  };
}
