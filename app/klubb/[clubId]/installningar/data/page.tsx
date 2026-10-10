import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EditableText } from "@/components/text-edit";
import { GuardianInfo } from "@/components/guardian-info";
import { requireClubAdmin } from "@/lib/assessment/data";
import { APP_NAME } from "@/lib/config";
import { formatDate } from "@/lib/format";
import { t, te } from "@/lib/i18n";
import { guardianInfoCopy } from "@/lib/privacy/guardian";
import { ClubDeletion, PlayerDeletion } from "./data-manager";

export const metadata: Metadata = { title: `Data och integritet – ${APP_NAME}` };

// Export and delete the club's data (spec §8). Admins only.
export default function DataPage({ params }: PageProps<"/klubb/[clubId]/installningar/data">) {
  return (
    <Suspense fallback={<p className="text-muted">{t("common.loading", "Laddar …")}</p>}>
      <Data params={params} />
    </Suspense>
  );
}

async function Data({ params }: Pick<PageProps<"/klubb/[clubId]/installningar/data">, "params">) {
  const { clubId } = await params;
  const { supabase, club, team } = await requireClubAdmin(clubId);

  const { data: rows } = team
    ? await supabase.from("players").select("id, shirt_number, full_name, is_active").eq("team_id", team.id)
    : { data: [] };
  const players = (rows ?? [])
    .map((p) => ({
      id: p.id as string,
      label: [p.shirt_number, p.full_name].filter(Boolean).join(" "),
      name: p.full_name as string,
      active: p.is_active as boolean,
    }))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "sv"));
  const exportUrl = `/klubb/${clubId}/installningar/data/export`;
  const guardian = team?.hasMinors ? guardianInfoCopy(club.name, team.name) : null;
  const linkClass =
    "inline-flex min-h-11 items-center rounded-lg border border-border bg-surface px-4 font-medium hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary-ink";

  return (
    <>
      <div>
        <p className="text-sm text-muted">{[club.name, team?.name].filter(Boolean).join(" · ")}</p>
        <EditableText as="h1" className="mt-1 text-2xl font-bold" {...te("data.title", "Data och integritet")} />
        <EditableText
          as="p"
          className="mt-2 text-muted"
          {...te(
            "data.intro",
            "Bedömningarna är personuppgifter och klubben är personuppgiftsansvarig. Här kan du ladda ner allt som finns sparat om klubben och radera spelare eller hela klubben.",
          )}
        />
        <Link
          href="/integritet"
          className="mt-2 inline-flex min-h-11 items-center font-medium text-primary-ink underline"
        >
          {t("data.privacyLink", "Så hanteras personuppgifter")}
        </Link>
      </div>

      <section
        aria-labelledby="export-title"
        className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <EditableText
          as="h2"
          id="export-title"
          className="text-lg font-semibold"
          {...te("data.export", "Exportera klubbens data")}
        />
        <EditableText
          as="p"
          className="text-sm text-muted"
          {...te(
            "data.exportBody",
            "Klubben, ledarna, inbjudningarna, truppen, inställningarna och alla inskickade bedömningar. Utkast som en ledare inte har skickat in syns bara för den ledaren och kommer inte med.",
          )}
        />
        <div className="flex flex-wrap gap-2">
          <a href={`${exportUrl}?format=json`} download className={linkClass}>
            {t("data.exportJson", "Ladda ner som JSON")}
          </a>
          <a href={`${exportUrl}?format=csv`} download className={linkClass}>
            {t("data.exportCsv", "Ladda ner som CSV (zip-fil)")}
          </a>
        </div>
      </section>

      {guardian && (
        <GuardianInfo
          clubId={clubId}
          text={guardian.text}
          confirmedOn={team?.guardianInfoConfirmedAt ? formatDate(team.guardianInfoConfirmedAt) : null}
          copy={guardian.copy}
        />
      )}

      <section
        aria-labelledby="players-title"
        className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <EditableText
          as="h2"
          id="players-title"
          className="text-lg font-semibold"
          {...te("data.players", "Radera en spelare")}
        />
        <EditableText
          as="p"
          className="text-sm text-muted"
          {...te(
            "data.playersBody",
            "Spelaren och alla bedömningar av spelaren tas bort för gott, till exempel när en vårdnadshavare ber om det.",
          )}
        />
        {players.length > 0 ? (
          <PlayerDeletion
            clubId={clubId}
            players={players}
            copy={{
              remove: t("data.players.remove", "Radera"),
              removeLabel: t("data.players.removeLabel", "Radera {name}"),
              confirmTitle: t("data.players.confirmTitle", "Radera {name}?"),
              confirmBody: t(
                "data.players.confirmBody",
                "Spelaren och alla bedömningar, positioner, närvarosiffror och kommentarer om spelaren raderas. Det går inte att ångra.",
              ),
              confirm: t("data.players.confirm", "Radera för gott"),
              cancel: t("common.cancel", "Avbryt"),
              removed: t("data.players.removed", "{name} är raderad."),
              inactive: t("data.players.inactive", "inte i truppen"),
            }}
          />
        ) : (
          <p className="text-sm text-muted">{t("data.players.none", "Laget har inga spelare.")}</p>
        )}
      </section>

      <section
        aria-labelledby="delete-club-title"
        className="flex flex-col gap-3 rounded-lg border border-danger/50 bg-surface p-4"
      >
        <EditableText
          as="h2"
          id="delete-club-title"
          className="text-lg font-semibold"
          {...te("data.club", "Radera klubben")}
        />
        <EditableText
          as="p"
          className="text-sm text-muted"
          {...te(
            "data.clubBody",
            "Allt raderas för gott: lag, spelare, bedömningar, inställningar, ledarnas medlemskap och klubbens filer. Ledarnas konton finns kvar. Ladda gärna ner klubbens data först.",
          )}
        />
        <ClubDeletion
          clubId={clubId}
          clubName={club.name}
          copy={{
            open: t("data.club.open", "Radera klubben …"),
            confirmTitle: t("data.club.confirmTitle", "Radera {name}?").replace("{name}", club.name),
            confirmBody: t(
              "data.club.confirmBody",
              "Klubben och allt som hör till den raderas för gott. Det går inte att ångra.",
            ),
            nameLabel: t("data.club.nameLabel", "Skriv klubbens namn, {name}, för att bekräfta"),
            confirm: t("data.club.confirm", "Radera klubben för gott"),
            cancel: t("common.cancel", "Avbryt"),
          }}
        />
      </section>
    </>
  );
}
