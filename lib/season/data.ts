import "server-only";
import { notFound } from "next/navigation";
import { type ClubContext, isUuid, requireClubMember } from "@/lib/assessment/data";
import { isPositionCode, type PositionCode } from "@/lib/positions";
import type { PlayerPlanStatus, RecruitmentStatus } from "./squad";
import {
  type Area,
  compareSeasonLabels,
  EMPTY_REVIEW,
  type Evaluation,
  type Half,
  type Match,
  parseGoalSources,
  type SeasonReview,
  type Training,
  type Venue,
} from "./summary";

type Supabase = ClubContext["supabase"];

export type Season = { id: string; label: string; isActive: boolean };

export type SeasonContext = ClubContext & {
  team: NonNullable<ClubContext["team"]>;
  /** The season on the page. `season` stays the team's active season. */
  current: Season;
  /** All the team's seasons, oldest first. */
  seasons: Season[];
};

export async function loadSeasons(supabase: Supabase, teamId: string): Promise<Season[]> {
  const { data } = await supabase.from("seasons").select("id, label, is_active").eq("team_id", teamId);
  return (data ?? [])
    .map((s) => ({ id: s.id as string, label: s.label as string, isActive: s.is_active as boolean }))
    .sort((a, b) => compareSeasonLabels(a.label, b.label));
}

/** A season page: the member's club context and the season, or a 404. */
export async function requireSeason(clubId: string, seasonId: string): Promise<SeasonContext> {
  const context = await requireClubMember(clubId);
  if (!context.team || !isUuid(seasonId)) notFound();
  const seasons = await loadSeasons(context.supabase, context.team.id);
  const current = seasons.find((s) => s.id === seasonId);
  if (!current) notFound();
  return { ...context, team: context.team, current, seasons };
}

export async function loadAreas(supabase: Supabase, teamId: string): Promise<Area[]> {
  const { data } = await supabase
    .from("evaluation_areas")
    .select("id, group_name, name, question")
    .eq("team_id", teamId)
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []).map((a) => ({ id: a.id, groupName: a.group_name, name: a.name, question: a.question }));
}

export async function loadMatches(supabase: Supabase, seasonId: string): Promise<Match[]> {
  const { data } = await supabase
    .from("season_matches")
    .select("id, round, played_on, opponent, venue, half, goals_for, goals_against, comment")
    .eq("season_id", seasonId)
    .order("round", { nullsFirst: false })
    .order("played_on", { nullsFirst: false })
    .order("created_at");
  return (data ?? []).map((m) => ({
    id: m.id,
    round: m.round,
    playedOn: m.played_on,
    opponent: m.opponent,
    venue: m.venue as Venue | null,
    half: m.half as Half | null,
    goalsFor: m.goals_for,
    goalsAgainst: m.goals_against,
    comment: m.comment,
  }));
}

export async function loadReview(supabase: Supabase, seasonId: string): Promise<SeasonReview> {
  const { data } = await supabase
    .from("season_reviews")
    .select("final_position, manual_matches, manual_points, manual_goals_for, manual_goals_against, goal_sources")
    .eq("season_id", seasonId)
    .maybeSingle();
  if (!data) return EMPTY_REVIEW;
  return {
    finalPosition: data.final_position,
    manualMatches: data.manual_matches,
    manualPoints: data.manual_points,
    manualGoalsFor: data.manual_goals_for,
    manualGoalsAgainst: data.manual_goals_against,
    goalSources: parseGoalSources(data.goal_sources),
  };
}

const EVALUATION_SELECT =
  "id, leader_id, status, strengths, weaknesses, outlook_level, outlook_position, outlook_key_factor, season_evaluation_ratings (area_id, score, training, comment)";

type EvaluationRow = {
  id: string;
  leader_id: string;
  status: "draft" | "submitted";
  strengths: string[];
  weaknesses: string[];
  outlook_level: number | null;
  outlook_position: number | null;
  outlook_key_factor: string | null;
  season_evaluation_ratings: { area_id: string; score: number | null; training: Training | null; comment: string | null }[];
};

function toEvaluation(row: EvaluationRow): Evaluation {
  return {
    leaderId: row.leader_id,
    strengths: row.strengths ?? [],
    weaknesses: row.weaknesses ?? [],
    outlookLevel: row.outlook_level,
    outlookPosition: row.outlook_position,
    outlookKeyFactor: row.outlook_key_factor,
    ratings: (row.season_evaluation_ratings ?? []).map((r) => ({
      areaId: r.area_id,
      score: r.score,
      training: r.training,
      comment: r.comment,
    })),
  };
}

/** Submitted evaluations of a season, oldest submission first. Drafts never count. */
export async function loadSubmittedEvaluations(supabase: Supabase, seasonId: string): Promise<Evaluation[]> {
  const { data } = await supabase
    .from("season_evaluations")
    .select(EVALUATION_SELECT)
    .eq("season_id", seasonId)
    .eq("status", "submitted")
    .order("submitted_at")
    .returns<EvaluationRow[]>();
  return (data ?? []).map(toEvaluation);
}

export async function loadOwnEvaluation(
  supabase: Supabase,
  seasonId: string,
  userId: string,
): Promise<{ status: "draft" | "submitted"; evaluation: Evaluation } | null> {
  const { data } = await supabase
    .from("season_evaluations")
    .select(EVALUATION_SELECT)
    .eq("season_id", seasonId)
    .eq("leader_id", userId)
    .returns<EvaluationRow[]>()
    .maybeSingle();
  return data ? { status: data.status, evaluation: toEvaluation(data) } : null;
}

/** Display names for leaders, unless the club shows leaders anonymously. */
export async function leaderNames(context: ClubContext, leaderIds: string[], you: string, fallback: string) {
  const anonymous = context.club.anonymousLeaderView;
  const { data: profiles } =
    anonymous || leaderIds.length === 0
      ? { data: [] }
      : await context.supabase.from("profiles").select("id, full_name, email").in("id", leaderIds);
  return (leaderId: string, index: number) => {
    if (leaderId === context.userId) return you;
    if (anonymous) return `${fallback} ${index + 1}`;
    const profile = profiles?.find((p) => p.id === leaderId);
    return profile?.full_name || profile?.email?.split("@")[0] || fallback;
  };
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

export type Plan = { goal: string; strategy: string; formation: string; keepDoing: string };

export type Priority = {
  id: string;
  area: string;
  goal: string;
  action: string;
  owner: string;
  followUp: string;
};

export type SquadPlanPlayer = { playerId: string; status: PlayerPlanStatus; position: PositionCode | null; note: string };
export type SquadPlanPosition = { code: PositionCode; wanted: number; roleNote: string };

export type RecruitmentTarget = {
  id: string;
  fullName: string;
  currentClub: string;
  position: PositionCode | null;
  priority: 1 | 2 | 3;
  status: RecruitmentStatus;
  note: string;
};

export async function loadPlan(supabase: Supabase, seasonId: string) {
  const [{ data: plan }, { data: priorities }, { data: positions }, { data: players }, { data: targets }] =
    await Promise.all([
      supabase.from("season_plans").select("goal, strategy, formation, keep_doing").eq("season_id", seasonId).maybeSingle(),
      supabase
        .from("plan_priorities")
        .select("id, area, goal, action, owner, follow_up")
        .eq("season_id", seasonId)
        .order("sort_order")
        .order("created_at"),
      supabase.from("squad_plan_positions").select("position_code, wanted_count, role_note").eq("season_id", seasonId),
      supabase.from("squad_plan_players").select("player_id, status, position_code, note").eq("season_id", seasonId),
      supabase
        .from("recruitment_targets")
        .select("id, full_name, current_club, position_code, priority, status, note")
        .eq("season_id", seasonId)
        .order("priority")
        .order("created_at"),
    ]);
  return {
    plan: {
      goal: plan?.goal ?? "",
      strategy: plan?.strategy ?? "",
      formation: plan?.formation ?? "",
      keepDoing: plan?.keep_doing ?? "",
    } satisfies Plan,
    priorities: (priorities ?? []).map(
      (p): Priority => ({
        id: p.id,
        area: p.area,
        goal: p.goal ?? "",
        action: p.action ?? "",
        owner: p.owner ?? "",
        followUp: p.follow_up ?? "",
      }),
    ),
    positions: (positions ?? [])
      .filter((p) => isPositionCode(p.position_code))
      .map((p): SquadPlanPosition => ({ code: p.position_code, wanted: p.wanted_count, roleNote: p.role_note ?? "" })),
    players: (players ?? []).map(
      (p): SquadPlanPlayer => ({
        playerId: p.player_id,
        status: p.status as PlayerPlanStatus,
        position: isPositionCode(p.position_code) ? p.position_code : null,
        note: p.note ?? "",
      }),
    ),
    targets: (targets ?? []).map(
      (r): RecruitmentTarget => ({
        id: r.id,
        fullName: r.full_name,
        currentClub: r.current_club ?? "",
        position: isPositionCode(r.position_code) ? r.position_code : null,
        priority: r.priority as 1 | 2 | 3,
        status: r.status as RecruitmentStatus,
        note: r.note ?? "",
      }),
    ),
  };
}
