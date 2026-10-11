"use server";

import { redirect } from "next/navigation";
import { isUuid, loadClubContext } from "@/lib/assessment/data";
import { DEFAULT_PHASES } from "@/lib/onboarding/defaults";
import {
  evaluationSchema,
  firstIssue,
  matchSchema,
  planSchema,
  prioritySchema,
  recruitSchema,
  reviewSchema,
  squadSchema,
} from "@/lib/season/validate";

export type ActionResult = { ok: true; id?: string } | { ok: false; message: string };

const SAVE_FAILED = "Det gick inte att spara. Försök igen.";

/** The caller's club context, if the season belongs to the club's team. */
async function seasonContext(clubId: string, seasonId: string) {
  const context = await loadClubContext(clubId);
  if (!context?.team || !isUuid(seasonId)) return null;
  const { data } = await context.supabase
    .from("seasons")
    .select("id")
    .eq("id", seasonId)
    .eq("team_id", context.team.id)
    .maybeSingle();
  return data ? { ...context, team: context.team } : null;
}

const SIGNED_OUT: ActionResult = { ok: false, message: "Du är inte inloggad längre. Logga in och försök igen." };

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

export async function createSeason(clubId: string, label: string): Promise<ActionResult> {
  const context = await loadClubContext(clubId);
  if (!context?.team) return SIGNED_OUT;
  if (context.role !== "admin") return { ok: false, message: "Bara klubbens admins kan skapa säsonger." };
  const clean = label.trim();
  if (!clean || clean.length > 20) return { ok: false, message: "Skriv säsongens namn, till exempel 2027." };
  const { data, error } = await context.supabase.rpc("create_season", {
    p_team_id: context.team.id,
    p_label: clean,
    p_phases: DEFAULT_PHASES,
  });
  if (error) {
    if (error.message.includes("already exists")) return { ok: false, message: `Laget har redan säsongen ${clean}.` };
    return { ok: false, message: SAVE_FAILED };
  }
  return { ok: true, id: data as string };
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

async function persistEvaluation(clubId: string, seasonId: string, input: unknown, submit: boolean): Promise<ActionResult> {
  const context = await seasonContext(clubId, seasonId);
  if (!context) return SIGNED_OUT;
  const parsed = evaluationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Utvärderingen kunde inte läsas. Ladda om sidan och försök igen." };
  const e = parsed.data;
  // Only answered areas are stored.
  const ratings = e.ratings.filter((r) => r.score !== null || r.training !== null || r.comment !== null);
  if (submit && !ratings.some((r) => r.score !== null)) {
    return { ok: false, message: "Betygsätt minst ett område innan du skickar in." };
  }
  const { error } = await context.supabase.rpc("save_season_evaluation", {
    p_season_id: seasonId,
    p_submit: submit,
    p_ratings: ratings.map((r) => ({ area_id: r.areaId, score: r.score, training: r.training, comment: r.comment })),
    p_strengths: e.strengths.filter(Boolean),
    p_weaknesses: e.weaknesses.filter(Boolean),
    p_outlook_level: e.outlookLevel,
    p_outlook_position: e.outlookPosition,
    p_outlook_key_factor: e.outlookKeyFactor,
  });
  if (error) {
    if (error.message.includes("submitted again")) {
      return { ok: false, message: "Utvärderingen är redan inskickad. Skicka in igen för att spara ändringarna." };
    }
    return { ok: false, message: SAVE_FAILED };
  }
  return { ok: true };
}

export async function saveEvaluationDraft(clubId: string, seasonId: string, input: unknown): Promise<ActionResult> {
  return persistEvaluation(clubId, seasonId, input, false);
}

export async function submitEvaluation(clubId: string, seasonId: string, input: unknown): Promise<ActionResult> {
  const result = await persistEvaluation(clubId, seasonId, input, true);
  if (!result.ok) return result;
  redirect(`/klubb/${clubId}/sasong/${seasonId}?inskickad=1`);
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export async function saveMatch(clubId: string, seasonId: string, input: unknown): Promise<ActionResult> {
  const parsed = matchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error, "Kontrollera matchen och försök igen.") };
  const context = await seasonContext(clubId, seasonId);
  if (!context) return SIGNED_OUT;
  const m = parsed.data;
  const row = {
    season_id: seasonId,
    round: m.round,
    played_on: m.playedOn,
    opponent: m.opponent,
    venue: m.venue,
    half: m.half,
    goals_for: m.goalsFor,
    goals_against: m.goalsAgainst,
    comment: m.comment,
  };
  const { data, error } = m.id
    ? await context.supabase.from("season_matches").update(row).eq("id", m.id).eq("season_id", seasonId).select("id").maybeSingle()
    : await context.supabase.from("season_matches").insert(row).select("id").single();
  if (error || !data) return { ok: false, message: SAVE_FAILED };
  return { ok: true, id: data.id };
}

export async function deleteMatch(clubId: string, seasonId: string, matchId: string): Promise<ActionResult> {
  const context = await seasonContext(clubId, seasonId);
  if (!context) return SIGNED_OUT;
  if (!isUuid(matchId)) return { ok: false, message: SAVE_FAILED };
  const { error } = await context.supabase.from("season_matches").delete().eq("id", matchId).eq("season_id", seasonId);
  return error ? { ok: false, message: SAVE_FAILED } : { ok: true };
}

export async function saveReview(clubId: string, seasonId: string, input: unknown): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Kontrollera siffrorna och försök igen." };
  const context = await seasonContext(clubId, seasonId);
  if (!context) return SIGNED_OUT;
  const r = parsed.data;
  const { error } = await context.supabase.from("season_reviews").upsert({
    season_id: seasonId,
    final_position: r.finalPosition,
    manual_matches: r.manualMatches,
    manual_points: r.manualPoints,
    manual_goals_for: r.manualGoalsFor,
    manual_goals_against: r.manualGoalsAgainst,
    goal_sources: r.goalSources,
  });
  return error ? { ok: false, message: SAVE_FAILED } : { ok: true };
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

export async function savePlan(clubId: string, seasonId: string, input: unknown): Promise<ActionResult> {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Texten är för lång. Korta den och försök igen." };
  const context = await seasonContext(clubId, seasonId);
  if (!context) return SIGNED_OUT;
  const p = parsed.data;
  const { error } = await context.supabase.from("season_plans").upsert({
    season_id: seasonId,
    goal: p.goal,
    strategy: p.strategy,
    formation: p.formation,
    keep_doing: p.keepDoing,
  });
  return error ? { ok: false, message: SAVE_FAILED } : { ok: true };
}

export async function savePriority(clubId: string, seasonId: string, input: unknown): Promise<ActionResult> {
  const parsed = prioritySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error, "Kontrollera prioriteringen och försök igen.") };
  const context = await seasonContext(clubId, seasonId);
  if (!context) return SIGNED_OUT;
  const p = parsed.data;
  const row = { area: p.area, goal: p.goal, action: p.action, owner: p.owner, follow_up: p.followUp };
  if (p.id) {
    const { data, error } = await context.supabase
      .from("plan_priorities")
      .update(row)
      .eq("id", p.id)
      .eq("season_id", seasonId)
      .select("id")
      .maybeSingle();
    return error || !data ? { ok: false, message: SAVE_FAILED } : { ok: true, id: data.id };
  }
  const { count } = await context.supabase
    .from("plan_priorities")
    .select("id", { count: "exact", head: true })
    .eq("season_id", seasonId);
  const { data, error } = await context.supabase
    .from("plan_priorities")
    .insert({ ...row, season_id: seasonId, sort_order: (count ?? 0) + 1 })
    .select("id")
    .single();
  return error || !data ? { ok: false, message: SAVE_FAILED } : { ok: true, id: data.id };
}

export async function deletePriority(clubId: string, seasonId: string, id: string): Promise<ActionResult> {
  const context = await seasonContext(clubId, seasonId);
  if (!context) return SIGNED_OUT;
  if (!isUuid(id)) return { ok: false, message: SAVE_FAILED };
  const { error } = await context.supabase.from("plan_priorities").delete().eq("id", id).eq("season_id", seasonId);
  return error ? { ok: false, message: SAVE_FAILED } : { ok: true };
}

/** Saves the desired squad: wanted players per position and each current player's place in the plan. */
export async function saveSquadPlan(clubId: string, seasonId: string, input: unknown): Promise<ActionResult> {
  const parsed = squadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Truppen kunde inte läsas. Ladda om sidan och försök igen." };
  const context = await seasonContext(clubId, seasonId);
  if (!context) return SIGNED_OUT;
  const { supabase } = context;
  const { positions, players } = parsed.data;

  const keep = positions.filter((p) => p.wanted > 0 || p.roleNote);
  const drop = positions.filter((p) => !(p.wanted > 0 || p.roleNote)).map((p) => p.code);
  const planned = players.filter((p) => p.status !== null);
  const unplanned = players.filter((p) => p.status === null).map((p) => p.playerId);

  const results = await Promise.all([
    keep.length
      ? supabase.from("squad_plan_positions").upsert(
          keep.map((p) => ({ season_id: seasonId, position_code: p.code, wanted_count: p.wanted, role_note: p.roleNote })),
        )
      : null,
    drop.length ? supabase.from("squad_plan_positions").delete().eq("season_id", seasonId).in("position_code", drop) : null,
    planned.length
      ? supabase.from("squad_plan_players").upsert(
          planned.map((p) => ({
            season_id: seasonId,
            player_id: p.playerId,
            status: p.status,
            position_code: p.position,
            note: p.note,
          })),
        )
      : null,
    unplanned.length
      ? supabase.from("squad_plan_players").delete().eq("season_id", seasonId).in("player_id", unplanned)
      : null,
  ]);
  return results.some((r) => r?.error) ? { ok: false, message: SAVE_FAILED } : { ok: true };
}

export async function saveRecruit(clubId: string, seasonId: string, input: unknown): Promise<ActionResult> {
  const parsed = recruitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error, "Kontrollera spelaren och försök igen.") };
  const context = await seasonContext(clubId, seasonId);
  if (!context) return SIGNED_OUT;
  const r = parsed.data;
  const row = {
    season_id: seasonId,
    full_name: r.fullName,
    current_club: r.currentClub,
    position_code: r.position,
    priority: r.priority,
    status: r.status,
    note: r.note,
  };
  const { data, error } = r.id
    ? await context.supabase.from("recruitment_targets").update(row).eq("id", r.id).eq("season_id", seasonId).select("id").maybeSingle()
    : await context.supabase.from("recruitment_targets").insert(row).select("id").single();
  return error || !data ? { ok: false, message: SAVE_FAILED } : { ok: true, id: data.id };
}

export async function deleteRecruit(clubId: string, seasonId: string, id: string): Promise<ActionResult> {
  const context = await seasonContext(clubId, seasonId);
  if (!context) return SIGNED_OUT;
  if (!isUuid(id)) return { ok: false, message: SAVE_FAILED };
  const { error } = await context.supabase.from("recruitment_targets").delete().eq("id", id).eq("season_id", seasonId);
  return error ? { ok: false, message: SAVE_FAILED } : { ok: true };
}
