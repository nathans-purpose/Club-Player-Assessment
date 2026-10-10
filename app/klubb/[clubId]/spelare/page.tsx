import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { loadPlayers, requireClubMember } from "@/lib/assessment/data";
import { leaderProgress } from "@/lib/calc";
import { APP_NAME } from "@/lib/config";
import { t } from "@/lib/i18n";
import { SQUAD_GROUP_LABELS } from "@/lib/players/squad-groups";
import { PlayerList, type PlayerListItem } from "./player-list";
import { ProgressBar } from "./progress-bar";

export const metadata: Metadata = { title: `Bedöm spelare – ${APP_NAME}` };

// The leader's way into Spelarkort: every active player with the leader's own
// status (Ej påbörjad / Utkast / Inskickad).
export default function PlayersPage({ params }: PageProps<"/klubb/[clubId]/spelare">) {
  return (
    <Suspense fallback={<p className="text-muted">{t("common.loading", "Laddar …")}</p>}>
      <Players params={params} />
    </Suspense>
  );
}

async function Players({ params }: Pick<PageProps<"/klubb/[clubId]/spelare">, "params">) {
  const { clubId } = await params;
  const { supabase, userId, role, club, team, season } = await requireClubMember(clubId);

  const players = team ? await loadPlayers(supabase, team.id) : [];
  const { data: mine } = season
    ? await supabase.from("assessments").select("player_id, status").eq("season_id", season.id).eq("leader_id", userId)
    : { data: [] };
  const statusOf = new Map((mine ?? []).map((a) => [a.player_id as string, a.status as "draft" | "submitted"]));
  const progress = leaderProgress(
    players.map((p) => p.id),
    [...statusOf].filter(([, s]) => s === "submitted").map(([id]) => id),
  );

  const items: PlayerListItem[] = players.map((p) => ({ ...p, status: statusOf.get(p.id) ?? "none" }));

  return (
    <>
      <div>
        <p className="text-sm text-muted">
          {club.name}
          {team && ` · ${team.name}`}
          {season && ` · ${season.label}`}
        </p>
        <h1 className="mt-1 text-2xl font-bold">{t("players.title", "Bedöm spelare")}</h1>
        <p className="mt-2 text-muted">
          {t(
            "players.intro",
            "Bedöm varje spelare på egen hand. Andra ledare ser din bedömning först när du har skickat in den.",
          )}
        </p>
      </div>

      {!season ? (
        <p className="rounded-lg border border-border bg-surface p-4">
          {t("players.noSeason", "Laget har ingen aktiv säsong ännu.")}
        </p>
      ) : players.length === 0 ? (
        <section className="rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">{t("players.empty.title", "Inga spelare i laget än")}</h2>
          {role === "admin" ? (
            <Link
              href={`/kom-igang/${clubId}/spelare`}
              className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-on-primary hover:opacity-90"
            >
              {t("players.empty.add", "Lägg till spelare")}
            </Link>
          ) : (
            <p className="mt-2 text-muted">
              {t("players.empty.leader", "När en admin har lagt till truppen kan du börja bedöma.")}
            </p>
          )}
        </section>
      ) : (
        <>
          <ProgressBar
            done={progress.done}
            total={progress.total}
            label={t("players.progress", "{done} av {total} spelare bedömda")
              .replace("{done}", String(progress.done))
              .replace("{total}", String(progress.total))}
          />
          <PlayerList
            clubId={clubId}
            players={items}
            copy={{
              search: t("players.search", "Sök spelare"),
              searchPlaceholder: t("players.searchPlaceholder", "Namn eller nummer"),
              noMatch: t("players.noMatch", "Ingen spelare matchar sökningen."),
              combined: t("players.combined", "Samlad bedömning"),
              combinedLabel: t("players.combinedLabel", "Samlad bedömning av {name}"),
              status: {
                none: t("players.status.none", "Ej påbörjad"),
                draft: t("players.status.draft", "Utkast"),
                submitted: t("players.status.submitted", "Inskickad"),
              },
              groups: Object.fromEntries(
                Object.entries(SQUAD_GROUP_LABELS).map(([k, v]) => [k, t(`squadGroup.${k}`, v)]),
              ) as typeof SQUAD_GROUP_LABELS,
            }}
          />
        </>
      )}
    </>
  );
}
