import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { ClubExport, ExportRow } from "./export";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const ids = (rows: ExportRow[], key = "id") => rows.map((r) => r[key] as string);

/**
 * Everything the club owns, read as the signed-in admin, so RLS keeps it to
 * this club. Leaders' unsent drafts are visible only to their authors and are
 * not included; invite tokens are left out.
 */
export async function loadClubExport(supabase: Supabase, clubId: string): Promise<ClubExport> {
  const rows = async (query: PromiseLike<{ data: unknown; error: { message: string } | null }>) => {
    const { data, error } = await query;
    if (error) throw new Error(`Export failed: ${error.message}`);
    return (data ?? []) as ExportRow[];
  };
  const none = (list: string[]) => list.length === 0;

  const [club] = await rows(
    supabase
      .from("clubs")
      .select("id, name, slug, crest_url, anonymous_leader_view, screen_friendly, created_at, updated_at")
      .eq("id", clubId),
  );
  const members = await rows(
    supabase.from("club_members").select("user_id, role, invited_by, joined_at, created_at").eq("club_id", clubId),
  );
  const [profiles, invites, teams, identity, texts] = await Promise.all([
    none(ids(members, "user_id"))
      ? []
      : rows(supabase.from("profiles").select("id, full_name, email").in("id", ids(members, "user_id"))),
    rows(supabase.from("invites").select("id, email, role, expires_at, accepted_at, created_at").eq("club_id", clubId)),
    rows(supabase.from("teams").select("*").eq("club_id", clubId)),
    rows(supabase.from("club_identity").select("*").eq("club_id", clubId)),
    rows(supabase.from("ui_text_overrides").select("key, value, updated_at").eq("club_id", clubId)),
  ]);

  const teamIds = ids(teams);
  const [seasons, players, categories, targets] = none(teamIds)
    ? [[], [], [], []]
    : await Promise.all([
        rows(supabase.from("seasons").select("*").in("team_id", teamIds)),
        rows(supabase.from("players").select("*").in("team_id", teamIds)),
        rows(supabase.from("categories").select("*").in("team_id", teamIds)),
        rows(supabase.from("position_targets").select("*").in("team_id", teamIds)),
      ]);

  const seasonIds = ids(seasons);
  const [phases, stats, subcategories, assessments] = await Promise.all([
    none(seasonIds) ? [] : rows(supabase.from("season_phases").select("*").in("season_id", seasonIds)),
    none(seasonIds) ? [] : rows(supabase.from("player_season_stats").select("*").in("season_id", seasonIds)),
    none(ids(categories)) ? [] : rows(supabase.from("subcategories").select("*").in("category_id", ids(categories))),
    none(seasonIds) ? [] : rows(supabase.from("assessments").select("*").in("season_id", seasonIds)),
  ]);

  // Säsong: evaluations (submitted only, like assessments), results and plans.
  const seasonRows = (table: string, select = "*") =>
    none(seasonIds) ? Promise.resolve([]) : rows(supabase.from(table).select(select).in("season_id", seasonIds));
  const [areas, evaluations, reviews, matches, plans, priorities, squadPositions, squadPlayers, recruits] =
    await Promise.all([
      none(teamIds) ? [] : rows(supabase.from("evaluation_areas").select("*").in("team_id", teamIds)),
      none(seasonIds)
        ? []
        : rows(supabase.from("season_evaluations").select("*").in("season_id", seasonIds).eq("status", "submitted")),
      seasonRows("season_reviews"),
      seasonRows("season_matches"),
      seasonRows("season_plans"),
      seasonRows("plan_priorities"),
      seasonRows("squad_plan_positions"),
      seasonRows("squad_plan_players"),
      seasonRows("recruitment_targets"),
    ]);
  const evaluationRatings = none(ids(evaluations))
    ? []
    : await rows(supabase.from("season_evaluation_ratings").select("*").in("evaluation_id", ids(evaluations)));

  const assessmentIds = ids(assessments);
  const [scores, positions, attendance] = none(assessmentIds)
    ? [[], [], []]
    : await Promise.all([
        rows(supabase.from("assessment_scores").select("*").in("assessment_id", assessmentIds)),
        rows(supabase.from("assessment_positions").select("*").in("assessment_id", assessmentIds)),
        rows(supabase.from("assessment_attendance").select("*").in("assessment_id", assessmentIds)),
      ]);

  const profileById = new Map(profiles.map((p) => [p.id as string, p]));
  return {
    exportedAt: new Date().toISOString(),
    club: club ?? null,
    tables: {
      members: members.map((m) => ({
        ...m,
        full_name: profileById.get(m.user_id as string)?.full_name ?? null,
        email: profileById.get(m.user_id as string)?.email ?? null,
      })),
      invites,
      teams,
      seasons,
      season_phases: phases,
      players,
      player_season_stats: stats,
      categories,
      subcategories,
      position_targets: targets,
      assessments,
      assessment_scores: scores,
      assessment_positions: positions,
      assessment_attendance: attendance,
      evaluation_areas: areas,
      season_evaluations: evaluations,
      season_evaluation_ratings: evaluationRatings,
      season_reviews: reviews,
      season_matches: matches,
      season_plans: plans,
      plan_priorities: priorities,
      squad_plan_positions: squadPositions,
      squad_plan_players: squadPlayers,
      recruitment_targets: recruits,
      club_identity: identity,
      ui_text_overrides: texts,
    },
  };
}
