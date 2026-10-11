import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EditableText } from "@/components/text-edit";
import { requireClubMember } from "@/lib/assessment/data";
import { APP_NAME } from "@/lib/config";
import { t, te } from "@/lib/i18n";
import { loadSeasons } from "@/lib/season/data";
import { nextSeasonLabel } from "@/lib/season/summary";
import { CreateSeason } from "./create-season";
import { card } from "./ui";

export const metadata: Metadata = { title: `Säsong – ${APP_NAME}` };

// Säsong: the team's seasons, each with its evaluation and its plan.
export default function SeasonsPage({ params }: PageProps<"/klubb/[clubId]/sasong">) {
  return (
    <Suspense fallback={<p className="text-muted">{t("common.loading", "Laddar …")}</p>}>
      <Seasons params={params} />
    </Suspense>
  );
}

async function Seasons({ params }: Pick<PageProps<"/klubb/[clubId]/sasong">, "params">) {
  const { clubId } = await params;
  const { supabase, userId, role, club, team } = await requireClubMember(clubId);
  const seasons = team ? (await loadSeasons(supabase, team.id)).reverse() : [];
  const { data: mine } = seasons.length
    ? await supabase
        .from("season_evaluations")
        .select("season_id, status")
        .eq("leader_id", userId)
        .in(
          "season_id",
          seasons.map((s) => s.id),
        )
    : { data: [] };
  const statusOf = new Map((mine ?? []).map((e) => [e.season_id as string, e.status as "draft" | "submitted"]));
  const latest = seasons[0]?.label ?? String(new Date().getFullYear());
  const base = `/klubb/${clubId}/sasong`;

  return (
    <>
      <div>
        <p className="text-sm text-muted">
          {club.name}
          {team && ` · ${team.name}`}
        </p>
        <EditableText as="h1" className="mt-1 text-2xl font-bold" {...te("season.title", "Säsong")} />
        <EditableText
          as="p"
          className="mt-2 max-w-prose text-muted"
          {...te(
            "season.intro",
            "Utvärdera hur säsongen gick som lag: resultat, taktik och träning. Planera sedan nästa säsong tillsammans i ledargruppen: strategi, trupp och värvningar. Spelarna ser inget av det här.",
          )}
        />
      </div>

      <ol className="flex flex-col gap-3" aria-label={t("season.list", "Säsonger")}>
        {seasons.map((s) => {
          const status = statusOf.get(s.id);
          return (
            <li key={s.id} className={card}>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h2 className="text-lg font-semibold">
                  {t("season.label", "Säsong {label}").replace("{label}", s.label)}
                </h2>
                {s.isActive && (
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 text-sm">
                    {t("season.active", "Aktiv säsong")}
                  </span>
                )}
                <span className="text-sm text-muted">
                  {status === "submitted"
                    ? t("season.myStatus.submitted", "Din utvärdering är inskickad")
                    : status === "draft"
                      ? t("season.myStatus.draft", "Din utvärdering är ett utkast")
                      : t("season.myStatus.none", "Du har inte utvärderat")}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4">
                <Link className="inline-flex min-h-11 items-center underline" href={`${base}/${s.id}`}>
                  {t("season.tab.summary", "Sammanställning")}
                </Link>
                <Link className="inline-flex min-h-11 items-center underline" href={`${base}/${s.id}/min-utvardering`}>
                  {t("season.tab.mine", "Min utvärdering")}
                </Link>
                <Link className="inline-flex min-h-11 items-center underline" href={`${base}/${s.id}/resultat`}>
                  {t("season.tab.results", "Resultat")}
                </Link>
                <Link className="inline-flex min-h-11 items-center underline" href={`${base}/${s.id}/planering`}>
                  {t("season.tab.plan", "Planering")}
                </Link>
              </div>
            </li>
          );
        })}
      </ol>

      {role === "admin" && team ? (
        <CreateSeason
          clubId={clubId}
          suggestion={nextSeasonLabel(latest)}
          copy={{
            title: t("season.create.title", "Lägg till säsong"),
            hint: t(
              "season.create.hint",
              "Lägg till nästa säsong för att planera den, eller förra säsongen för att kunna jämföra. Den aktiva säsongen, som spelarna bedöms i, ändras inte.",
            ),
            label: t("season.create.label", "Säsong"),
            submit: t("season.create.submit", "Lägg till"),
            saving: t("common.saving", "Sparar …"),
          }}
        />
      ) : (
        <EditableText
          as="p"
          className="text-sm text-muted"
          {...te("season.create.leader", "En admin kan lägga till nästa säsong, så att ni kan planera den.")}
        />
      )}
    </>
  );
}
