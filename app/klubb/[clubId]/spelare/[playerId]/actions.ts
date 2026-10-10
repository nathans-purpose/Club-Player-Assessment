"use server";

import { redirect } from "next/navigation";
import { isUuid, loadCategories, loadClubContext } from "@/lib/assessment/data";
import { fromPayload, missingItems, parsePayload } from "@/lib/assessment/form";

export type SaveResult = { ok: true } | { ok: false; message: string };

async function persist(clubId: string, playerId: string, input: unknown, submit: boolean): Promise<SaveResult> {
  const context = await loadClubContext(clubId);
  if (!context) return { ok: false, message: "Du är inte inloggad längre. Logga in och försök igen." };
  const { supabase, team, season } = context;
  if (!team || !season) return { ok: false, message: "Laget har ingen aktiv säsong." };
  if (!isUuid(playerId)) return { ok: false, message: "Spelaren hittades inte." };

  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("id", playerId)
    .eq("team_id", team.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!player) return { ok: false, message: "Spelaren hittades inte." };

  const payload = parsePayload(input);
  if (!payload) return { ok: false, message: "Bedömningen kunde inte läsas. Ladda om sidan och försök igen." };

  if (submit) {
    const { form } = await loadCategories(supabase, team.id);
    if (missingItems(fromPayload(payload), form).length > 0) {
      return { ok: false, message: "Svara på alla frågor som behövs innan du skickar in." };
    }
  }

  const { error } = await supabase.rpc("save_assessment", {
    p_season_id: season.id,
    p_player_id: playerId,
    p_submit: submit,
    p_comment: payload.comment,
    p_scores: payload.scores.map((s) => ({ category_id: s.categoryId, subcategory_id: s.subcategoryId, score: s.score })),
    p_positions: payload.positions.map((p) => ({ position_code: p.code, level: p.level })),
    p_attendance: payload.attendance.map((a) => ({ phase_id: a.phaseId, value: a.value })),
  });
  if (error) {
    if (error.message.includes("submitted again")) {
      return { ok: false, message: "Bedömningen är redan inskickad. Skicka in igen för att spara ändringarna." };
    }
    return { ok: false, message: "Det gick inte att spara. Försök igen." };
  }
  return { ok: true };
}

/** Autosave for drafts. */
export async function saveDraft(clubId: string, playerId: string, input: unknown): Promise<SaveResult> {
  return persist(clubId, playerId, input, false);
}

/** Submits (or resubmits) and continues to the thank-you screen. */
export async function submitAssessment(clubId: string, playerId: string, input: unknown): Promise<SaveResult> {
  const result = await persist(clubId, playerId, input, true);
  if (!result.ok) return result;
  redirect(`/klubb/${clubId}/spelare/${playerId}/tack`);
}
