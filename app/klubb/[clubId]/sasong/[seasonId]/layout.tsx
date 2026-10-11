import Link from "next/link";
import { Suspense } from "react";
import { t } from "@/lib/i18n";
import { requireSeason } from "@/lib/season/data";
import { SeasonTabs } from "./season-tabs";

// One season: its label, the other seasons and the tabs for evaluation,
// results and planning.
export default function SeasonLayout({ children, params }: LayoutProps<"/klubb/[clubId]/sasong/[seasonId]">) {
  return (
    <>
      <Suspense fallback={null}>
        <Header params={params} />
      </Suspense>
      {children}
    </>
  );
}

async function Header({ params }: Pick<LayoutProps<"/klubb/[clubId]/sasong/[seasonId]">, "params">) {
  const { clubId, seasonId } = await params;
  const { club, team, current, seasons } = await requireSeason(clubId, seasonId);
  const others = seasons.filter((s) => s.id !== current.id);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Link href={`/klubb/${clubId}/sasong`} className="inline-flex min-h-11 items-center text-sm underline">
          {t("season.back", "← Alla säsonger")}
        </Link>
        <p className="text-sm text-muted">
          {club.name} · {team.name}
        </p>
        <h1 className="text-2xl font-bold">{t("season.label", "Säsong {label}").replace("{label}", current.label)}</h1>
        {others.length > 0 && (
          <p className="mt-1 text-sm text-muted">
            {t("season.others", "Andra säsonger:")}{" "}
            {others.map((s, i) => (
              <span key={s.id}>
                {i > 0 && ", "}
                <Link className="underline" href={`/klubb/${clubId}/sasong/${s.id}`}>
                  {s.label}
                </Link>
              </span>
            ))}
          </p>
        )}
      </div>
      <SeasonTabs
        label={t("season.tabs", "Säsongens sidor")}
        tabs={[
          { path: "", label: t("season.tab.summary", "Sammanställning") },
          { path: "min-utvardering", label: t("season.tab.mine", "Min utvärdering") },
          { path: "resultat", label: t("season.tab.results", "Resultat") },
          { path: "planering", label: t("season.tab.plan", "Planering") },
        ]}
      />
    </div>
  );
}
