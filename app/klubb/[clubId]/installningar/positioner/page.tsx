import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { loadPositionTargets, requireClubAdmin } from "@/lib/assessment/data";
import { APP_NAME } from "@/lib/config";
import { t } from "@/lib/i18n";
import { POSITION_LABELS, type PositionCode } from "@/lib/positions";
import { MAX_TARGET } from "@/lib/settings/positions";
import { PositionsEditor } from "./positions-editor";

export const metadata: Metadata = { title: `Positioner på planen – ${APP_NAME}` };

// Positioner på planen (admins only): which positions the team's pitch shows
// and how many players the team needs on each.
export default function PositionsPage({ params }: PageProps<"/klubb/[clubId]/installningar/positioner">) {
  return (
    <Suspense fallback={<p className="text-muted">{t("common.loading", "Laddar …")}</p>}>
      <Positions params={params} />
    </Suspense>
  );
}

async function Positions({ params }: Pick<PageProps<"/klubb/[clubId]/installningar/positioner">, "params">) {
  const { clubId } = await params;
  const { supabase, club, team } = await requireClubAdmin(clubId);
  const targets = team ? await loadPositionTargets(supabase, team.id) : [];

  return (
    <>
      <div>
        <Link href={`/klubb/${clubId}/installningar`} className="inline-flex min-h-11 items-center text-sm underline">
          {t("settings.back", "← Inställningar")}
        </Link>
        <p className="text-sm text-muted">{[club.name, team?.name].filter(Boolean).join(" · ")}</p>
        <h1 className="mt-1 text-2xl font-bold">{t("settings.positions", "Positioner på planen")}</h1>
        <p className="mt-2 max-w-prose text-muted">
          {t(
            "settings.positions.intro",
            "Tryck på en position för att visa eller dölja den på lagets plan. Antalet är hur många spelare laget behöver som kan spela där; det styr färgen under Antal i Översikt.",
          )}
        </p>
      </div>
      {team ? (
        <PositionsEditor
          clubId={clubId}
          gameFormat={team.gameFormat}
          initial={Object.fromEntries(targets.map((r) => [r.code, r.target]))}
          copy={positionsCopy()}
        />
      ) : (
        <p className="rounded-lg border border-border bg-surface p-4">{t("settings.noTeam", "Klubben har inget lag ännu.")}</p>
      )}
    </>
  );
}

function positionsCopy() {
  return {
    pitch: t("settings.positions.pitch", "Planen"),
    spotShown: t("settings.positions.spotShown", "{position}, visas, {n} behövs"),
    spotHidden: t("settings.positions.spotHidden", "{position}, dold"),
    presets: t("settings.positions.presets", "Uppställningar"),
    presetsHint: t("settings.positions.presetsHint", "Ersätter positionerna och antalen ovan."),
    presetPlayers: t("settings.positions.presetPlayers", "{n} spelare"),
    presetApplied: t("settings.positions.presetApplied", "Uppställningen {name} ersatte positionerna."),
    undo: t("common.undo", "Ångra"),
    targetsTitle: t("settings.positions.targets", "Antal per position"),
    targetsEmpty: t("settings.positions.targetsEmpty", "Inga positioner visas. Tryck på planen för att lägga till."),
    decrease: t("settings.positions.decrease", "Färre på {position}"),
    increase: t("settings.positions.increase", "Fler på {position}"),
    count: t("settings.positions.count", "Antal på {position}"),
    hide: t("settings.positions.hide", "Dölj"),
    hideLabel: t("settings.positions.hideLabel", "Dölj {position}"),
    total: t("settings.positions.total", "{n} spelare på planen"),
    format: t("settings.positions.format", "Laget spelar {n} mot {n}."),
    mismatch: t(
      "settings.positions.mismatch",
      "Antalen blir {total}, men laget spelar {n} mot {n}. Det går bra att spara, till exempel om ni vill ha fler på en position.",
    ),
    maxTarget: String(MAX_TARGET),
    save: t("common.saveChanges", "Spara ändringar"),
    saving: t("common.saving", "Sparar …"),
    saved: t("common.saved", "Sparat"),
    unsaved: t("common.unsaved", "Osparade ändringar"),
    positions: Object.fromEntries(
      Object.entries(POSITION_LABELS).map(([k, v]) => [k, t(`position.${k}`, v)]),
    ) as Record<PositionCode, string>,
  };
}

export type PositionsCopy = ReturnType<typeof positionsCopy>;
