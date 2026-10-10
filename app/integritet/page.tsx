import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { APP_NAME } from "@/lib/config";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: `Integritet – ${APP_NAME}` };

// A short privacy notice (spec §8). Open to everyone, signed in or not.
export default function PrivacyPage() {
  return (
    <LegalPage title={t("privacy.title", "Så hanteras personuppgifter")}>
      <LegalSection title={t("privacy.controller", "Vem som ansvarar")}>
        <p>
          {t(
            "privacy.controller.body",
            "Varje klubb som använder appen är personuppgiftsansvarig för uppgifterna om sina spelare och ledare. Appen behandlar uppgifterna för klubbens räkning, som personuppgiftsbiträde. Frågor om en spelares uppgifter ställs till klubben.",
          )}
        </p>
      </LegalSection>
      <LegalSection title={t("privacy.what", "Vilka uppgifter som sparas")}>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>{t("privacy.what.leaders", "Om ledare: namn, e-postadress och vilken roll de har i klubben.")}</li>
          <li>
            {t(
              "privacy.what.players",
              "Om spelare: namn, tröjnummer och lagdel, och om klubben vill antal matcher, mål, assist och gula kort.",
            )}
          </li>
          <li>
            {t("privacy.what.assessments", "Ledarnas bedömningar: betyg, positioner, träningsnärvaro och kommentarer.")}
          </li>
        </ul>
        <p>
          {t(
            "privacy.what.not",
            "Appen sparar inga foton av spelare, inga födelsedatum och inga personnummer. Spelare har inga konton och ser aldrig bedömningarna.",
          )}
        </p>
      </LegalSection>
      <LegalSection title={t("privacy.why", "Varför")}>
        <p>
          {t(
            "privacy.why.body",
            "Uppgifterna används bara för att klubbens ledare tillsammans ska kunna bedöma spelarna och planera träning och laguttagning. Den rättsliga grunden bestämmer klubben, oftast berättigat intresse.",
          )}
        </p>
      </LegalSection>
      <LegalSection title={t("privacy.who", "Vem som ser vad")}>
        <p>
          {t(
            "privacy.who.body",
            "Bara klubbens ledare och administratörer ser klubbens uppgifter. En ledares utkast syns bara för ledaren själv tills det skickas in. Ingen i en annan klubb kan se något.",
          )}
        </p>
      </LegalSection>
      <LegalSection title={t("privacy.where", "Var uppgifterna finns")}>
        <p>
          {t(
            "privacy.where.body",
            "Uppgifterna lagras inom EU. När en klubb läser in en spellista eller en grafisk profil skickas filen till en AI-tjänst som läser den, och filen raderas direkt efteråt.",
          )}
        </p>
      </LegalSection>
      <LegalSection title={t("privacy.rights", "Rättigheter")}>
        <p>
          {t(
            "privacy.rights.body",
            "Spelare, vårdnadshavare och ledare har rätt att få veta vad som finns sparat och att få det rättat eller raderat. Klubbens administratörer kan exportera all klubbens data och radera en spelare eller hela klubben under Inställningar, Data och integritet. Den som är missnöjd kan vända sig till Integritetsskyddsmyndigheten (IMY).",
          )}
        </p>
      </LegalSection>
      <LegalSection title={t("privacy.retention", "Hur länge")}>
        <p>
          {t(
            "privacy.retention.body",
            "Uppgifterna finns kvar tills klubben raderar dem. Klubben bör radera spelare som har lämnat och bedömningar som inte längre behövs.",
          )}
        </p>
      </LegalSection>
    </LegalPage>
  );
}
