import { t } from "@/lib/i18n";

/** The information text for guardians and the labels around it, through t() so clubs can reword them. */
export function guardianInfoCopy(clubName: string, teamName: string) {
  const text = t(
    "guardian.template",
    `Hej!

Vi ledare i {club} ({team}) bedömer spelarna under säsongen, så att vi kan planera träningen och ge varje spelare rätt utmaningar. Varje ledare sätter betyg på till exempel teknik och spelförståelse, noterar vilka positioner spelaren passar på och hur ofta spelaren tränar, och kan skriva en kort kommentar.

Bedömningarna syns bara för lagets ledare, aldrig för spelarna eller för andra föräldrar. Vi sparar inga foton, födelsedatum eller personnummer, och inga uppgifter om hälsa.

Klubben är personuppgiftsansvarig. Du har rätt att få veta vad som finns sparat om ditt barn och att be oss rätta eller radera det. Hör av dig till oss ledare om du har frågor.`,
  )
    .replaceAll("{club}", clubName)
    .replaceAll("{team}", teamName);

  return {
    text,
    copy: {
      title: t("guardian.title", "Information till vårdnadshavare"),
      intro: t(
        "guardian.intro",
        "Laget har spelare under 18 år. Skicka gärna den här texten till vårdnadshavarna innan ni börjar bedöma, till exempel i lagets vanliga kanal. Ni kan ändra den som ni vill.",
      ),
      copy: t("guardian.copy", "Kopiera texten"),
      copied: t("common.copied", "Kopierat!"),
      confirm: t("guardian.confirm", "Vårdnadshavarna har fått informationen"),
      confirmed: t("guardian.confirmed", "Vårdnadshavarna informerades {date}."),
    },
  };
}
