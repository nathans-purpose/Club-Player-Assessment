import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireClubMember } from "@/lib/assessment/data";
import { APP_NAME } from "@/lib/config";
import { EditableText } from "@/components/text-edit";
import { t, te } from "@/lib/i18n";
import { DisplayOptions } from "./display-options";

export const metadata: Metadata = { title: `Inställningar – ${APP_NAME}` };

// The admin's settings hub. Leaders only have Så räknas det, so they go there.
export default function SettingsPage({ params }: PageProps<"/klubb/[clubId]/installningar">) {
  return (
    <Suspense fallback={<p className="text-muted">{t("common.loading", "Laddar …")}</p>}>
      <Settings params={params} />
    </Suspense>
  );
}

async function Settings({ params }: Pick<PageProps<"/klubb/[clubId]/installningar">, "params">) {
  const { clubId } = await params;
  const { role, club, team } = await requireClubMember(clubId);
  if (role !== "admin") redirect(`/klubb/${clubId}/installningar/sa-raknas-det`);

  const base = `/klubb/${clubId}/installningar`;
  const pages = [
    {
      href: `${base}/visuell-identitet`,
      title: t("settings.identity", "Visuell identitet"),
      body: t("settings.identityBody", "Klubbens färger, loggor och typsnitt, inlästa från den grafiska profilen."),
    },
    {
      href: `${base}/kategorier`,
      title: t("settings.categories", "Bedömningskategorier"),
      body: t("settings.categoriesBody", "Vad ledarna betygsätter, med frågor och underkategorier."),
    },
    {
      href: `${base}/positioner`,
      title: t("settings.positions", "Positioner på planen"),
      body: t("settings.positionsBody", "Vilka positioner som visas och hur många spelare ni behöver på varje."),
    },
    {
      href: `${base}/data`,
      title: t("settings.data", "Data och integritet"),
      body: t(
        "settings.dataBody",
        "Exportera klubbens data, radera spelare eller hela klubben, och information till vårdnadshavare.",
      ),
    },
    {
      href: `${base}/sa-raknas-det`,
      title: t("settings.howItWorks", "Så räknas det"),
      body: t("settings.howItWorksBody", "Hur snitt, oenighet, närvaro och positioner räknas. Alla ledare ser sidan."),
    },
  ];

  return (
    <>
      <div>
        <p className="text-sm text-muted">{[club.name, team?.name].filter(Boolean).join(" · ")}</p>
        <EditableText as="h1" className="mt-1 text-2xl font-bold" {...te("settings.title", "Inställningar")} />
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {pages.map((p) => (
          <li key={p.href}>
            <Link
              href={p.href}
              className="flex h-full min-h-11 flex-col gap-1 rounded-lg border border-border bg-surface p-4 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary-ink"
            >
              <span className="font-semibold">{p.title}</span>
              <span className="text-sm text-muted">{p.body}</span>
            </Link>
          </li>
        ))}
      </ul>

      <DisplayOptions
        clubId={clubId}
        initial={{ anonymousLeaderView: club.anonymousLeaderView, screenFriendly: club.screenFriendly }}
        copy={{
          title: t("settings.display", "Visning"),
          anonymous: t("settings.display.anonymous", "Anonym ledarvy"),
          anonymousHint: t(
            "settings.display.anonymousHint",
            "Den samlade bedömningen visar bara snitt och spridning, inte vad varje ledare har gett. Kommentarer visas utan namn.",
          ),
          screenFriendly: t("settings.display.screenFriendly", "Skärmvänligt läge"),
          screenFriendlyHint: t(
            "settings.display.screenFriendlyHint",
            "För att visa Översikt på en stor skärm: det står Lägst i stället för Svagast.",
          ),
          save: t("common.save", "Spara"),
          saving: t("common.saving", "Sparar …"),
          saved: t("common.saved", "Sparat"),
        }}
      />
    </>
  );
}
