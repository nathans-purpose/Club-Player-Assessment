import type { Metadata } from "next";
import { Suspense } from "react";
import { APP_NAME } from "@/lib/config";
import { t } from "@/lib/i18n";
import { requireAdminClub } from "@/lib/onboarding/club";
import { REVIEW_STATUS_LABELS } from "@/lib/players/review";
import { SQUAD_GROUP_LABELS } from "@/lib/players/squad-groups";
import { createClient } from "@/lib/supabase/server";
import { Stepper } from "../../stepper";
import { PlayersEditor } from "./players-editor";

export const metadata: Metadata = { title: `Lägg till spelare – ${APP_NAME}` };

// Reading a photo or PDF with Claude can take a while.
export const maxDuration = 120;

// Kom igång 3: players, read from an uploaded file, typed in or pasted.
export default function PlayersStepPage({ params, searchParams }: PageProps<"/kom-igang/[clubId]/spelare">) {
  return (
    <>
      <Stepper current={3} />
      <Suspense fallback={<p className="text-muted">{t("common.loading", "Laddar …")}</p>}>
        <PlayersStep params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function PlayersStep({ params, searchParams }: PageProps<"/kom-igang/[clubId]/spelare">) {
  const { clubId } = await params;
  const { klubbmarke } = await searchParams;
  const { club, team } = await requireAdminClub(clubId);

  const supabase = await createClient();
  const { data: players } = team
    ? await supabase.from("players").select("shirt_number, full_name").eq("team_id", team.id)
    : { data: [] };
  const existing = (players ?? []).map((p) => ({ shirtNumber: p.shirt_number, fullName: p.full_name }));
  const nextHref = `/kom-igang/${clubId}/ledare`;

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">{t("onboarding.players.title", "Lägg till spelarna")}</h1>
        <p className="mt-2 text-muted">
          {t(
            "onboarding.players.intro",
            "Ladda upp truppen för {team}, klistra in en lista eller skriv in spelarna. Spelarna får inga konton och ser aldrig bedömningarna.",
          ).replace("{team}", team?.name ?? club.name)}
        </p>
      </div>

      {klubbmarke === "fel" && (
        <p role="status" className="rounded-lg border border-border bg-surface-muted p-3 text-sm">
          {t(
            "onboarding.players.crestFailed",
            "Klubben är skapad, men klubbmärket kunde inte laddas upp. Du kan lägga till det senare.",
          )}
        </p>
      )}

      {existing.length > 0 && (
        <p className="text-sm text-muted">
          {t("onboarding.players.existing", "{count} spelare finns redan i laget. Nya spelare läggs till dem.").replace(
            "{count}",
            String(existing.length),
          )}
        </p>
      )}

      <PlayersEditor
        clubId={clubId}
        existing={existing}
        skipHref={nextHref}
        copy={{
          pasteTitle: t("onboarding.players.paste.title", "Klistra in en lista"),
          pasteHint: t(
            "onboarding.players.paste.hint",
            "En spelare per rad: nummer, namn och gärna lagdel. Till exempel ”7 Kalle Ek mittfält”.",
          ),
          pasteLabel: t("onboarding.players.paste.label", "Spelarlista"),
          pasteSubmit: t("onboarding.players.paste.submit", "Lägg till i listan"),
          pasteAdded: t("onboarding.players.paste.added", "{count} spelare har lagts till i listan."),
          listTitle: t("onboarding.players.list.title", "Spelare"),
          number: t("onboarding.players.number", "Nr"),
          name: t("onboarding.players.name", "Namn"),
          squadGroup: t("onboarding.players.squadGroup", "Lagdel"),
          squadGroupNone: t("onboarding.players.squadGroupNone", "Välj lagdel"),
          source: t("onboarding.players.source", "Från texten"),
          status: t("onboarding.players.status", "Status"),
          rowLabel: t("onboarding.players.rowLabel", "Spelare {n}"),
          remove: t("onboarding.players.remove", "Ta bort"),
          removeLabel: t("onboarding.players.removeLabel", "Ta bort spelare {n}"),
          undo: t("common.undo", "Ångra"),
          removed: t("onboarding.players.removed", "Spelaren togs bort."),
          addRow: t("onboarding.players.addRow", "+ Lägg till spelare"),
          filter: t("onboarding.players.filter", "Visa bara de som behöver kontrolleras"),
          filterEmpty: t("onboarding.players.filterEmpty", "Inga spelare behöver kontrolleras."),
          summary: t("onboarding.players.summary", "{count} spelare, {check} behöver kontrolleras"),
          save: t("onboarding.players.save", "Spara {count} spelare"),
          saving: t("onboarding.players.saving", "Sparar …"),
          saveEmpty: t("onboarding.players.saveEmpty", "Lägg till minst en spelare, eller hoppa över steget."),
          duplicatesBlock: t("onboarding.players.duplicates", "Ta bort eller ändra dubbletterna innan du sparar."),
          skip: t("onboarding.players.skip", "Hoppa över"),
          statusLabels: Object.fromEntries(
            Object.entries(REVIEW_STATUS_LABELS).map(([k, v]) => [k, t(`onboarding.players.statusLabel.${k}`, v)]),
          ) as typeof REVIEW_STATUS_LABELS,
          uncertain: t("onboarding.players.uncertain", "Osäker läsning: {fields}"),
          confirm: t("onboarding.players.confirm", "Det stämmer"),
          confirmLabel: t("onboarding.players.confirmLabel", "Det stämmer, spelare {n}"),
          uncertainLabels: {
            shirt_number: t("onboarding.players.uncertainField.shirt_number", "nummer"),
            full_name: t("onboarding.players.uncertainField.full_name", "namn"),
            squad_group: t("onboarding.players.uncertainField.squad_group", "lagdel"),
          },
          upload: {
            title: t("onboarding.players.upload.title", "Ladda upp en lista"),
            hint: t(
              "onboarding.players.upload.hint",
              "Foto, skärmbild, PDF, Excel, CSV eller Word, högst 20 MB. Vi läser av spelarna och raderar filen direkt. Inget sparas förrän du har kontrollerat listan.",
            ),
            choose: t("onboarding.players.upload.choose", "Välj fil"),
            chooseMore: t("onboarding.players.upload.chooseMore", "Ladda upp en fil till"),
            reading: t("onboarding.players.upload.reading", "Läser {file} …"),
            added: t(
              "onboarding.players.upload.added",
              "{count} spelare hittades i {file}. Kontrollera listan innan du sparar.",
            ),
            wrongType: t(
              "onboarding.players.upload.wrongType",
              "Den filtypen kan vi inte läsa. Använd en bild, PDF, Excel (.xlsx), CSV eller Word (.docx).",
            ),
            tooBig: t("onboarding.players.upload.tooBig", "Filen är större än 20 MB."),
            uploadFailed: t("onboarding.players.upload.failed", "Filen kunde inte laddas upp. Försök igen."),
          },
          groupLabels: Object.fromEntries(
            Object.entries(SQUAD_GROUP_LABELS).map(([k, v]) => [k, t(`squadGroup.${k}`, v)]),
          ) as typeof SQUAD_GROUP_LABELS,
        }}
      />
    </>
  );
}
