"use server";

import { loadClubContext, loadPositionTargets } from "@/lib/assessment/data";
import { type Targets, validateTargets } from "@/lib/settings/positions";

export type SaveTargetsResult = { ok: true; targets: Targets } | { ok: false; message: string };

/** Replaces the positions on the team's pitch in one transaction (save_position_targets). */
export async function saveTargets(clubId: string, input: unknown): Promise<SaveTargetsResult> {
  const checked = validateTargets(input);
  if (!checked.ok) return checked;

  const context = await loadClubContext(clubId);
  if (!context || context.role !== "admin" || !context.team) {
    return { ok: false, message: "Bara klubbens admins kan ändra positionerna." };
  }
  const { supabase, team } = context;

  const { error } = await supabase.rpc("save_position_targets", { p_team_id: team.id, p_targets: checked.rows });
  if (error) return { ok: false, message: "Det gick inte att spara positionerna. Försök igen." };

  const stored = await loadPositionTargets(supabase, team.id);
  return { ok: true, targets: Object.fromEntries(stored.map((r) => [r.code, r.target])) };
}
