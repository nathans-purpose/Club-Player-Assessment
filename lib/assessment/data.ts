import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { setRequestTexts } from "@/lib/i18n";
import type { Assessment, AssessmentStatus, AttendanceValue, Category } from "@/lib/calc";
import type { SquadGroup } from "@/lib/players/squad-groups";
import type { PositionCode, PositionLevel } from "@/lib/positions";
import { createClient } from "@/lib/supabase/server";
import type { FormCategory, Payload } from "./form";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ClubContext = {
  supabase: Supabase;
  userId: string;
  role: "admin" | "leader";
  club: { id: string; name: string; crestUrl: string | null; anonymousLeaderView: boolean; screenFriendly: boolean };
  team: {
    id: string;
    name: string;
    gameFormat: number;
    hasMinors: boolean;
    guardianInfoConfirmedAt: string | null;
  } | null;
  season: { id: string; label: string } | null;
};

/**
 * The signed-in user's view of a club: their role, the club's first team and
 * its active season. Null when signed out or not a member. Cached per request,
 * since the layout's header and the page both need it. Also puts the club's
 * text overrides in place, so every `t()` after this uses them.
 */
export const loadClubContext = cache(async (clubId: string): Promise<ClubContext | null> => {
  if (!isUuid(clubId)) return null;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const [{ data: membership }, { data: club }, { data: team }, { data: texts }] = await Promise.all([
    supabase.from("club_members").select("role").eq("club_id", clubId).eq("user_id", userId).maybeSingle(),
    supabase
      .from("clubs")
      .select("id, name, crest_url, anonymous_leader_view, screen_friendly")
      .eq("id", clubId)
      .maybeSingle(),
    supabase
      .from("teams")
      .select("id, name, game_format, has_minors, guardian_info_confirmed_at")
      .eq("club_id", clubId)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
    supabase.from("ui_text_overrides").select("key, value").eq("club_id", clubId),
  ]);
  if (!membership || !club) return null;
  setRequestTexts(Object.fromEntries((texts ?? []).map((row) => [row.key as string, row.value as string])));

  const { data: season } = team
    ? await supabase.from("seasons").select("id, label").eq("team_id", team.id).eq("is_active", true).maybeSingle()
    : { data: null };

  return {
    supabase,
    userId,
    role: membership.role as "admin" | "leader",
    club: {
      id: club.id,
      name: club.name,
      crestUrl: club.crest_url,
      anonymousLeaderView: club.anonymous_leader_view,
      screenFriendly: club.screen_friendly,
    },
    team: team
      ? {
          id: team.id,
          name: team.name,
          gameFormat: team.game_format,
          hasMinors: team.has_minors,
          guardianInfoConfirmedAt: team.guardian_info_confirmed_at,
        }
      : null,
    season,
  };
});

/**
 * For pages: signed-out visitors go to the login page; anyone who is not a
 * member gets a 404, so club ids cannot be probed.
 */
export async function requireClubMember(clubId: string): Promise<ClubContext> {
  const context = await loadClubContext(clubId);
  if (context) return context;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/logga-in");
  notFound();
}

/** For admin-only pages: leaders get a 404, as if the page did not exist. */
export async function requireClubAdmin(clubId: string): Promise<ClubContext> {
  const context = await requireClubMember(clubId);
  if (context.role !== "admin") notFound();
  return context;
}

export type Player = {
  id: string;
  shirtNumber: string | null;
  fullName: string;
  squadGroup: SquadGroup | null;
};

/** Active players in list order: by shirt number, then name. */
export async function loadPlayers(supabase: Supabase, teamId: string): Promise<Player[]> {
  const { data } = await supabase
    .from("players")
    .select("id, shirt_number, full_name, squad_group")
    .eq("team_id", teamId)
    .eq("is_active", true);
  const number = (n: string | null) => (n && /^\d+$/.test(n) ? Number(n) : Number.POSITIVE_INFINITY);
  return (data ?? [])
    .map((p) => ({
      id: p.id as string,
      shirtNumber: p.shirt_number as string | null,
      fullName: p.full_name as string,
      squadGroup: p.squad_group as SquadGroup | null,
    }))
    .sort(
      (a, b) =>
        number(a.shirtNumber) - number(b.shirtNumber) ||
        (a.shirtNumber ?? "").localeCompare(b.shirtNumber ?? "", "sv") ||
        a.fullName.localeCompare(b.fullName, "sv"),
    );
}

type CategoryRow = {
  id: string;
  name: string;
  question: string | null;
  is_active: boolean;
  sort_order: number;
  subcategories: { id: string; name: string; is_active: boolean; sort_order: number }[];
};

/** All of the team's categories (for calculations) and the active ones (for the form). */
export async function loadCategories(
  supabase: Supabase,
  teamId: string,
): Promise<{ all: Category[]; form: FormCategory[] }> {
  const { data } = await supabase
    .from("categories")
    .select("id, name, question, is_active, sort_order, subcategories(id, name, is_active, sort_order)")
    .eq("team_id", teamId)
    .order("sort_order")
    .returns<CategoryRow[]>();
  const rows = (data ?? []).map((c) => ({
    ...c,
    subcategories: [...c.subcategories].sort((a, b) => a.sort_order - b.sort_order),
  }));
  return {
    all: rows.map((c) => ({
      id: c.id,
      name: c.name,
      isActive: c.is_active,
      subcategories: c.subcategories.map((s) => ({ id: s.id, name: s.name, isActive: s.is_active })),
    })),
    form: rows
      .filter((c) => c.is_active)
      .map((c) => ({
        id: c.id,
        name: c.name,
        question: c.question,
        subcategories: c.subcategories.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name })),
      })),
  };
}

export async function loadPhases(supabase: Supabase, seasonId: string): Promise<{ id: string; name: string }[]> {
  const { data } = await supabase
    .from("season_phases")
    .select("id, name")
    .eq("season_id", seasonId)
    .order("sort_order");
  return data ?? [];
}

/** Positions shown on the team's pitch (spec: a target row means shown). */
export async function loadPositionTargets(
  supabase: Supabase,
  teamId: string,
): Promise<{ code: PositionCode; target: number }[]> {
  const { data } = await supabase.from("position_targets").select("position_code, target_count").eq("team_id", teamId);
  return (data ?? []).map((r) => ({ code: r.position_code as PositionCode, target: r.target_count as number }));
}

export const ASSESSMENT_SELECT =
  "id, player_id, leader_id, status, comment, submitted_at, " +
  "assessment_scores(category_id, subcategory_id, score), " +
  "assessment_positions(position_code, level), " +
  "assessment_attendance(phase_id, value)";

export type AssessmentRow = {
  id: string;
  player_id: string;
  leader_id: string;
  status: AssessmentStatus;
  comment: string | null;
  submitted_at: string | null;
  assessment_scores: { category_id: string; subcategory_id: string | null; score: number }[];
  assessment_positions: { position_code: string; level: number }[];
  assessment_attendance: { phase_id: string; value: number }[];
};

export function toCalcAssessment(row: AssessmentRow): Assessment {
  return {
    leaderId: row.leader_id,
    status: row.status,
    scores: row.assessment_scores.map((s) => ({
      categoryId: s.category_id,
      subcategoryId: s.subcategory_id,
      score: s.score,
    })),
    positions: row.assessment_positions.map((p) => ({
      code: p.position_code as PositionCode,
      level: p.level as PositionLevel,
    })),
    attendance: row.assessment_attendance.map((a) => ({ phaseId: a.phase_id, value: a.value as AttendanceValue })),
  };
}

export function toPayloadFromRow(row: AssessmentRow): Payload {
  const calc = toCalcAssessment(row);
  return { comment: row.comment ?? "", scores: calc.scores, positions: calc.positions, attendance: calc.attendance };
}

async function loadOwnPlayerIds(supabase: Supabase, seasonId: string, userId: string, status: AssessmentStatus) {
  const { data } = await supabase
    .from("assessments")
    .select("player_id")
    .eq("season_id", seasonId)
    .eq("leader_id", userId)
    .eq("status", status);
  return (data ?? []).map((r) => r.player_id as string);
}

/** Player ids this leader has submitted in the season. */
export async function loadSubmittedPlayerIds(supabase: Supabase, seasonId: string, userId: string): Promise<string[]> {
  return loadOwnPlayerIds(supabase, seasonId, userId, "submitted");
}

/** Player ids this leader has skipped ("Hoppa över") in the season. */
export async function loadSkippedPlayerIds(supabase: Supabase, seasonId: string, userId: string): Promise<string[]> {
  return loadOwnPlayerIds(supabase, seasonId, userId, "skipped");
}
