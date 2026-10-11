import type { Metadata } from "next";
import { Suspense } from "react";
import { EditableText } from "@/components/text-edit";
import {
  ASSESSMENT_SELECT,
  type AssessmentRow,
  loadCategories,
  loadPlayers,
  loadPositionTargets,
  toCalcAssessment,
} from "@/lib/assessment/data";
import { mainPosition, summarizePlayer } from "@/lib/calc";
import { APP_NAME } from "@/lib/config";
import { t, te } from "@/lib/i18n";
import {
  common,
  planCopy,
  positionLabels,
  prioritiesCopy,
  recruitsCopy,
  squadCopy,
  statusLabels,
} from "@/lib/season/copy";
import { loadAreas, loadPlan, loadSubmittedEvaluations, requireSeason } from "@/lib/season/data";
import { previousSeason, suggestedPriorities, summariseAreas } from "@/lib/season/summary";
import { card } from "../../ui";
import { PlanForm } from "./plan-form";
import { PlanBoard } from "./plan-board";

export const metadata: Metadata = { title: `Planering – ${APP_NAME}` };

type Props = PageProps<"/klubb/[clubId]/sasong/[seasonId]/planering">;

// Planering: the leaders' shared plan for the season: strategy, at most a
// few improvement priorities, the squad they want and who to recruit.
export default function PlanningPage({ params }: Props) {
  return (
    <Suspense fallback={<p className="text-muted">{t("common.loading", "Laddar …")}</p>}>
      <Planning params={params} />
    </Suspense>
  );
}

async function Planning({ params }: Pick<Props, "params">) {
  const { clubId, seasonId } = await params;
  const { supabase, userId, team, current, seasons, season: active } = await requireSeason(clubId, seasonId);
  const previous = previousSeason(seasons, current);

  const [plan, players, targets, categories, { data: assessmentRows }, previousEvaluations, areas] = await Promise.all([
    loadPlan(supabase, current.id),
    loadPlayers(supabase, team.id),
    loadPositionTargets(supabase, team.id),
    loadCategories(supabase, team.id),
    active
      ? supabase
          .from("assessments")
          .select(ASSESSMENT_SELECT)
          .eq("season_id", active.id)
          .eq("status", "submitted")
          .returns<AssessmentRow[]>()
      : { data: [] as AssessmentRow[] },
    previous ? loadSubmittedEvaluations(supabase, previous.id) : [],
    loadAreas(supabase, team.id),
  ]);

  // What the player cards say: each player's average and main position.
  const byPlayer = new Map<string, AssessmentRow[]>();
  for (const row of assessmentRows ?? []) byPlayer.set(row.player_id, [...(byPlayer.get(row.player_id) ?? []), row]);
  const squad = players.map((p) => {
    const calc = (byPlayer.get(p.id) ?? []).map(toCalcAssessment);
    return {
      ...p,
      average: calc.length ? summarizePlayer(categories.all, calc).totalAverage : null,
      mainPosition: calc.length ? mainPosition(calc) : null,
    };
  });

  // Suggestions from last season's evaluation, once the leader has submitted their own.
  const suggestions =
    previous && previousEvaluations.some((e) => e.leaderId === userId)
      ? suggestedPriorities(summariseAreas(areas, previousEvaluations)).map((r) => ({
          area: r.area.name,
          prioritise: r.prioritise,
          average: r.average,
        }))
      : [];

  return (
    <>
      <div>
        <EditableText as="h2" className="text-xl font-semibold" {...te("season.plan.title", "Planering")} />
        <EditableText
          as="p"
          className="mt-1 max-w-prose text-muted"
          {...te(
            "season.plan.intro",
            "Ledargruppens gemensamma plan. Alla ledare kan skriva här, och varje del sparas för sig.",
          )}
        />
      </div>

      <section className={card} aria-labelledby="strategy">
        <EditableText as="h3" id="strategy" className="text-lg font-semibold" {...te("season.plan.strategyTitle", "Strategi")} />
        <PlanForm clubId={clubId} seasonId={current.id} initial={plan.plan} copy={planCopy()} common={common()} />
      </section>

      <PlanBoard
        clubId={clubId}
        seasonId={current.id}
        previousLabel={previous?.label ?? ""}
        suggestions={suggestions}
        priorities={plan.priorities}
        players={squad}
        wishes={plan.positions}
        defaultTargets={targets}
        plannedPlayers={plan.players}
        recruits={plan.targets}
        copy={{
          headings: {
            priorities: t("season.plan.prioritiesTitle", "Förbättringsområden"),
            prioritiesHint: t(
              "season.plan.prioritiesHint",
              "Högst tre. Varje får ett mätbart mål, en åtgärd, en ägare och en tidpunkt för uppföljning.",
            ),
            squad: t("season.plan.squadTitle", "Truppen ni vill ha"),
            recruits: t("season.plan.recruitsTitle", "Värvningsönskemål"),
            recruitsHint: t("season.plan.recruitsHint", "Spelare utanför klubben som ni vill försöka få hit."),
            average: t("season.plan.cardAverage", "Snitt på spelarkortet"),
            mainPosition: t("season.plan.cardPosition", "Huvudposition enligt spelarkorten: {position}"),
          },
          priorities: prioritiesCopy(),
          squad: squadCopy(),
          recruits: recruitsCopy(),
          statuses: statusLabels(),
          positions: positionLabels(),
          common: common(),
        }}
      />
    </>
  );
}
