import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { APP_NAME } from "@/lib/config";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: `Villkor – ${APP_NAME}` };

// Placeholder terms of use (spec §8), to be written before launch.
export default function TermsPage() {
  return (
    <LegalPage title={t("terms.title", "Användarvillkor")}>
      <LegalSection title={t("terms.use", "Att använda appen")}>
        <p>
          {t(
            "terms.use.body",
            "Appen är till för föreningar som vill bedöma sina spelare tillsammans. Den som skapar en klubb gör det för föreningens räkning och ansvarar för att föreningen får behandla uppgifterna om sina spelare.",
          )}
        </p>
      </LegalSection>
      <LegalSection title={t("terms.content", "Klubbens innehåll")}>
        <p>
          {t(
            "terms.content.body",
            "Allt klubben lägger in tillhör klubben. Klubben kan när som helst exportera sina uppgifter eller radera klubben.",
          )}
        </p>
      </LegalSection>
      <LegalSection title={t("terms.privacy", "Personuppgifter")}>
        <p>
          {t("terms.privacy.body", "Hur personuppgifter hanteras står på sidan om integritet.")}{" "}
          <Link href="/integritet" className="font-medium underline">
            {t("terms.privacy.link", "Läs om integritet")}
          </Link>
        </p>
      </LegalSection>
      <LegalSection title={t("terms.placeholder", "Resten av villkoren")}>
        <p>
          {t(
            "terms.placeholder.body",
            "Här kommer villkor om ansvar, tillgänglighet, ändringar och uppsägning när tjänsten lanseras.",
          )}
        </p>
      </LegalSection>
    </LegalPage>
  );
}
