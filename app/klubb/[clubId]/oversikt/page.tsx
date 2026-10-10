import type { Metadata } from "next";
import { Suspense } from "react";
import {
  ASSESSMENT_SELECT,
  type AssessmentRow,
  loadCategories,
  loadPhases,
  loadPlayers,
  loadPositionTargets,
  loadSubmittedPlayerIds,
  requireClubMember,
  toCalcAssessment,
} from "@/lib/assessment/data";
import { APP_NAME } from "@/lib/config";
import { EditableText } from "@/components/text-edit";
import { t, te } from "@/lib/i18n";
import { buildOverview } from "@/lib/overview";
import { overviewCopy } from "./copy";
import { OverviewView } from "./overview-view";

export const metadata: Metadata = { title: `Översikt – ${APP_NAME}` };

// The squad overview: KPIs, the team pitch, radar, Fakta and
// "Lag, bäst och svagast" on the first tab, and a sortable table on "Data".
// Every leader in the club sees it; only submitted assessments count.
export default function OverviewPage({ params, searchParams }: PageProps<"/klubb/[clubId]/oversikt">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <Suspense fallback={<p className="text-muted">{t("common.loading", "Laddar …")}</p>}>
        <Overview params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Overview({ params, searchParams }: PageProps<"/klubb/[clubId]/oversikt">) {
  const { clubId } = await params;
  const { flik } = await searchParams;
  const { supabase, userId, club, team, season } = await requireClubMember(clubId);

  if (!team || !season) {
    return (
      <>
        <EditableText as="h1" className="text-2xl font-bold" {...te("overview.title", "Översikt")} />
        <EditableText
          as="p"
          className="rounded-lg border border-border bg-surface p-4"
          {...te("players.noSeason", "Laget har ingen aktiv säsong ännu.")}
        />
      </>
    );
  }

  const [players, categories, phases, targets, mine, { data: rows }, { data: stats }, { count: leaderCount }] =
    await Promise.all([
      loadPlayers(supabase, team.id),
      loadCategories(supabase, team.id),
      loadPhases(supabase, season.id),
      loadPositionTargets(supabase, team.id),
      loadSubmittedPlayerIds(supabase, season.id, userId),
      supabase
        .from("assessments")
        .select(ASSESSMENT_SELECT)
        .eq("season_id", season.id)
        .eq("status", "submitted")
        .returns<AssessmentRow[]>(),
      supabase
        .from("player_season_stats")
        .select("player_id, matches, goals, assists, yellow_cards")
        .eq("season_id", season.id),
      supabase.from("club_members").select("user_id", { count: "exact", head: true }).eq("club_id", clubId),
    ]);

  // Players who have left the squad keep their history but leave the overview.
  const playerIds = new Set(players.map((p) => p.id));
  const overview = buildOverview({
    players,
    categories: categories.all,
    phases,
    targets,
    assessments: (rows ?? [])
      .filter((r) => playerIds.has(r.player_id))
      .map((r) => ({ playerId: r.player_id, assessment: toCalcAssessment(r) })),
    stats: (stats ?? []).map((s) => ({
      playerId: s.player_id as string,
      matches: s.matches as number | null,
      goals: s.goals as number | null,
      assists: s.assists as number | null,
      yellowCards: s.yellow_cards as number | null,
    })),
    leaderCount: leaderCount ?? 0,
  });

  return (
    <OverviewView
      clubId={clubId}
      heading={{
        kicker: [club.name, team.name, season.label].join(" · "),
        title: te("overview.title", "Översikt"),
      }}
      overview={overview}
      submittedByMe={mine}
      initialTab={flik === "data" ? "data" : "overview"}
      copy={overviewCopy({ screenFriendly: club.screenFriendly })}
    />
  );
}
