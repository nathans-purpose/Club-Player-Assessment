import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config";
import { t } from "@/lib/i18n";
import { Stepper } from "../stepper";
import { ClubForm } from "./club-form";

export const metadata: Metadata = { title: `Skapa klubben – ${APP_NAME}` };

// Kom igång 2: club and first team. The proxy guarantees a signed-in user.
export default function ClubStepPage() {
  return (
    <>
      <Stepper current={2} />
      <div>
        <h1 className="text-2xl font-bold">{t("onboarding.club.title", "Skapa klubben")}</h1>
        <p className="mt-2 text-muted">
          {t(
            "onboarding.club.intro",
            "Börja med ett lag. Du blir klubbens admin och kan bjuda in fler ledare i sista steget.",
          )}
        </p>
      </div>
      <ClubForm
        copy={{
          clubName: t("onboarding.club.clubName", "Klubbens namn"),
          clubNamePlaceholder: t("onboarding.club.clubNamePlaceholder", "Till exempel Exempelklubben IF"),
          teamName: t("onboarding.club.teamName", "Lagets namn"),
          teamNameHint: t("onboarding.club.teamNameHint", "Till exempel Herr A, Dam U19 eller P15."),
          gameFormat: t("onboarding.club.gameFormat", "Spelform"),
          gameFormatHint: t(
            "onboarding.club.gameFormatHint",
            "Styr vilka positioner som visas på planen. Du kan ändra dem senare.",
          ),
          gameFormatOption: t("onboarding.club.gameFormatOption", "{n} mot {n}"),
          hasMinors: t("onboarding.club.hasMinors", "Är några spelare under 18 år?"),
          hasMinorsHint: t(
            "onboarding.club.hasMinorsHint",
            "Då får du en informationstext till vårdnadshavare innan ni börjar bedöma.",
          ),
          yes: t("common.yes", "Ja"),
          no: t("common.no", "Nej"),
          crest: t("onboarding.club.crest", "Klubbmärke (valfritt)"),
          crestHint: t("onboarding.club.crestHint", "PNG, JPG eller WebP, högst 2 MB."),
          crestRemove: t("onboarding.club.crestRemove", "Ta bort klubbmärket"),
          preview: t("onboarding.club.preview", "Förhandsvisning"),
          previewClubName: t("onboarding.club.previewClubName", "Klubbens namn"),
          previewTeamName: t("onboarding.club.previewTeamName", "Lagets namn"),
          previewMinors: t("onboarding.club.previewMinors", "Spelare under 18"),
          submit: t("onboarding.club.submit", "Skapa klubben"),
          submitting: t("onboarding.club.submitting", "Skapar …"),
        }}
      />
    </>
  );
}
