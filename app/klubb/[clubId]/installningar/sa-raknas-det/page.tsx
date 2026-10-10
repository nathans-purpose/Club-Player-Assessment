import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { requireClubMember } from "@/lib/assessment/data";
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_VALUES,
  DISAGREEMENT_SPREAD,
  FEW_ASSESSMENTS_BELOW,
  LOW_ATTENDANCE_BELOW,
  POSITION_WEIGHTS,
  RADAR_MAX,
  RADAR_MIN,
  RATE_MIN_MATCHES,
  SCALE_COLORS,
} from "@/lib/calc";
import { APP_NAME } from "@/lib/config";
import { formatPercent } from "@/lib/format";
import { t } from "@/lib/i18n";
import { POSITION_LEVEL_LABELS, POSITION_LEVELS } from "@/lib/positions";

export const metadata: Metadata = { title: `Så räknas det – ${APP_NAME}` };

// Så räknas det: the calculation rules in lib/calc.ts (spec §5) in plain
// Swedish. Open to every leader. The numbers come from calc.ts, so the page
// follows the code if a threshold changes.
export default function HowItWorksPage({ params }: PageProps<"/klubb/[clubId]/installningar/sa-raknas-det">) {
  return (
    <Suspense fallback={<p className="text-muted">{t("common.loading", "Laddar …")}</p>}>
      <HowItWorks params={params} />
    </Suspense>
  );
}

const decimal = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 });

async function HowItWorks({ params }: Pick<PageProps<"/klubb/[clubId]/installningar/sa-raknas-det">, "params">) {
  const { clubId } = await params;
  const { role, club } = await requireClubMember(clubId);

  const fill = (text: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), text);

  return (
    <article className="flex max-w-prose flex-col gap-6">
      <div>
        {role === "admin" && (
          <Link href={`/klubb/${clubId}/installningar`} className="inline-flex min-h-11 items-center text-sm underline">
            {t("settings.back", "← Inställningar")}
          </Link>
        )}
        <p className="text-sm text-muted">{club.name}</p>
        <h1 className="mt-1 text-2xl font-bold">{t("howItWorks.title", "Så räknas det")}</h1>
        <p className="mt-2 text-muted">
          {t(
            "howItWorks.intro",
            "Varje ledare bedömer spelarna på egen hand. Appen lägger ihop allas bedömningar till en gemensam bild. Siffrorna är ungefärliga, men de bygger på flera ledares omdöme, och när ni tycker olika syns det.",
          )}
        </p>
      </div>

      <Section title={t("howItWorks.submitted.title", "Bara inskickade bedömningar räknas")}>
        <p>
          {t(
            "howItWorks.submitted.body",
            "Ett utkast räknas aldrig. Först när en ledare trycker Skicka in kommer bedömningen med i snitten, och ändrar ledaren den sedan räknas den nya versionen när den skickas in igen.",
          )}
        </p>
      </Section>

      <Section title={t("howItWorks.scores.title", "Betyg och snitt")}>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            {t(
              "howItWorks.scores.category",
              "Varje ledare ger ett betyg 1–10 per kategori. Är kategorin fördjupad i underkategorier blir ledarens betyg för kategorin snittet av ledarens betyg på underkategorierna.",
            )}
          </li>
          <li>
            {t(
              "howItWorks.scores.average",
              "Spelarens snitt i en kategori är snittet av alla ledares betyg i kategorin.",
            )}
          </li>
          <li>
            {t("howItWorks.scores.total", "Totalt snitt är snittet av spelarens kategorisnitt.")}
          </li>
          <li>
            {t(
              "howItWorks.scores.removed",
              "Tas en kategori bort syns den inte längre i formuläret eller i översikten, men betyg som redan har getts sparas.",
            )}
          </li>
        </ul>
      </Section>

      <Section title={t("howItWorks.disagreement.title", "Oeniga – diskutera")}>
        <p>
          {fill(
            t(
              "howItWorks.disagreement.body",
              "Skiljer det {n} steg eller mer mellan ledarnas högsta och lägsta betyg i en kategori eller underkategori, markeras spelaren med Oeniga – diskutera. Det betyder inte att någon har fel, bara att ni ser olika på spelaren och bör prata om det.",
            ),
            { n: DISAGREEMENT_SPREAD },
          )}
        </p>
      </Section>

      <Section title={t("howItWorks.few.title", "Få bedömningar")}>
        <p>
          {fill(
            t(
              "howItWorks.few.body",
              "En spelare med färre än {n} inskickade bedömningar märks med få bedömningar och visas nedtonad i topplistorna, eftersom ett snitt av en eller två ledare säger mindre.",
            ),
            { n: FEW_ASSESSMENTS_BELOW },
          )}
        </p>
      </Section>

      <Section title={t("howItWorks.attendance.title", "Träningsnärvaro")}>
        <p>{t("howItWorks.attendance.body", "Ledarna uppskattar närvaron för varje del av säsongen. Svaren räknas om till procent:")}</p>
        <ul className="list-disc space-y-1 pl-5">
          {ATTENDANCE_VALUES.map((v) => (
            <li key={v}>
              {t(`attendance.${v}`, ATTENDANCE_LABELS[v])}: {formatPercent(v)}
            </li>
          ))}
          <li>{t("howItWorks.attendance.unknown", "Vet ej: räknas inte alls")}</li>
        </ul>
        <p>
          {fill(
            t(
              "howItWorks.attendance.average",
              "Närvaron för en period är snittet av de ledare som svarade. Under {percent} visas den i varningsfärg.",
            ),
            { percent: formatPercent(LOW_ATTENDANCE_BELOW) },
          )}
        </p>
      </Section>

      <Section title={t("howItWorks.positions.title", "Positioner")}>
        <p>
          {t(
            "howItWorks.positions.body",
            "Ledarna väljer vilka positioner spelaren kan spela och hur bra. Nivåerna har ett värde och en vikt:",
          )}
        </p>
        <ul className="list-disc space-y-1 pl-5">
          {POSITION_LEVELS.map((level) => (
            <li key={level}>
              {fill(t("howItWorks.positions.level", "{label}: värde {value}, vikt {weight}"), {
                label: t(`positionLevel.${level}`, POSITION_LEVEL_LABELS[level]),
                value: level,
                weight: decimal.format(POSITION_WEIGHTS[level]),
              })}
            </li>
          ))}
        </ul>
        <p>
          {t(
            "howItWorks.positions.player",
            "För varje position visas hur många ledare som valde den och snittnivån, avrundad. Huvudpositionen är den position där summan av ledarnas nivåer är högst.",
          )}
        </p>
      </Section>

      <Section title={t("howItWorks.pitch.title", "Planen i Översikt")}>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            {t(
              "howItWorks.pitch.count",
              "Antal: varje spelare som kan spela positionen räknas med sin vikt. Summan jämförs med hur många laget behöver där, enligt Positioner på planen. Siffran visar hur många som är naturliga eller funkar bra, till exempel 2 av 3.",
            )}
          </li>
          <li>
            {fill(
              t(
                "howItWorks.pitch.attribute",
                "Teknik, Fysik och de andra kategorierna, och Totalt: snittbetyget för spelarna som kan spela positionen, där naturliga spelare väger tyngst. Ett snitt på {low} eller lägre blir rött och {high} eller högre grönt.",
              ),
              { low: decimal.format(5.5), high: decimal.format(8) },
            )}
          </li>
          <li>
            {t(
              "howItWorks.pitch.colors",
              "Färgen går från rött över gult till grönt, och siffran visas alltid bredvid. De starkaste positionerna lyser.",
            )}{" "}
            <span className="inline-flex gap-1 align-middle" aria-hidden="true">
              {[SCALE_COLORS.low, SCALE_COLORS.mid, SCALE_COLORS.high].map((c) => (
                <span key={c} className="inline-block size-3 rounded-full" style={{ background: c }} />
              ))}
            </span>
          </li>
        </ul>
      </Section>

      <Section title={t("howItWorks.radar.title", "Radarn")}>
        <p>
          {fill(
            t(
              "howItWorks.radar.body",
              "Radarn visar lagets snitt per kategori jämfört med en lagdel. Mitten är {min} och kanten {max}, så skillnaderna syns tydligt.",
            ),
            { min: RADAR_MIN, max: RADAR_MAX },
          )}
        </p>
      </Section>

      <Section
        title={
          club.screenFriendly
            ? t("howItWorks.rankings.titleLowest", "Lag, bäst och lägst")
            : t("howItWorks.rankings.title", "Lag, bäst och svagast")
        }
      >
        <ul className="list-disc space-y-2 pl-5">
          <li>
            {fill(
              t(
                "howItWorks.rankings.rate",
                "Mål, assist och gula kort per match räknas bara för spelare med minst {n} matcher.",
              ),
              { n: RATE_MIN_MATCHES },
            )}
          </li>
          <li>{t("howItWorks.rankings.keepers", "Mål och assist räknas inte för målvakter.")}</li>
          <li>
            {t(
              "howItWorks.rankings.ties",
              "Delar flera spelare platsen visas antalet spelare, och alla visas när du trycker.",
            )}
          </li>
        </ul>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
