import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { EditableText } from "@/components/text-edit";
import { attributeT, scaleColor } from "@/lib/calc";
import { APP_NAME } from "@/lib/config";
import { formatCount, formatRateShort, formatScore } from "@/lib/format";
import { t, te } from "@/lib/i18n";
import { goalSourceLabels } from "@/lib/season/copy";
import {
  leaderNames,
  loadAreas,
  loadMatches,
  loadReview,
  loadSubmittedEvaluations,
  requireSeason,
} from "@/lib/season/data";
import {
  type AreaSummary,
  compareTotals,
  goalSourceShares,
  groupAverages,
  matchRecord,
  nextSeasonLabel,
  overallAverage,
  previousSeason,
  seasonTotals,
  splits,
  strongestAndWeakest,
  summariseAreas,
  summariseOutlook,
} from "@/lib/season/summary";
import { buttonPrimary, card } from "../ui";

export const metadata: Metadata = { title: `Säsongens sammanställning – ${APP_NAME}` };

type Props = PageProps<"/klubb/[clubId]/sasong/[seasonId]">;

// Sammanställning: the season in numbers and the leaders' combined
// evaluation. Like the player cards, a leader sees the others' ratings only
// after submitting their own.
export default function SummaryPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<p className="text-muted">{t("common.loading", "Laddar …")}</p>}>
      <Summary params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Summary({ params, searchParams }: Props) {
  const { clubId, seasonId } = await params;
  const { inskickad } = await searchParams;
  const context = await requireSeason(clubId, seasonId);
  const { supabase, userId, team, current, seasons } = context;
  const previous = previousSeason(seasons, current);
  const following = seasons.find((s) => s.label === nextSeasonLabel(current.label));

  const [areas, matches, review, evaluations, prevMatches, prevReview, { count: memberCount }] = await Promise.all([
    loadAreas(supabase, team.id),
    loadMatches(supabase, current.id),
    loadReview(supabase, current.id),
    loadSubmittedEvaluations(supabase, current.id),
    previous ? loadMatches(supabase, previous.id) : [],
    previous ? loadReview(supabase, previous.id) : null,
    supabase.from("club_members").select("user_id", { count: "exact", head: true }).eq("club_id", clubId),
  ]);

  const base = `/klubb/${clubId}/sasong/${current.id}`;
  const record = matchRecord(matches);
  const totals = seasonTotals(matches, review);
  const comparison = previous && prevReview ? compareTotals(seasonTotals(prevMatches, prevReview), totals) : null;
  const hasComparison = comparison?.some((c) => c.previous !== null);
  const goals = goalSourceShares(review.goalSources);
  const sourceLabels = goalSourceLabels();
  const submittedOwn = evaluations.some((e) => e.leaderId === userId);
  const nextLabel = following?.label ?? nextSeasonLabel(current.label);

  return (
    <>
      {inskickad && submittedOwn && (
        <p role="status" className="rounded-lg border border-primary/40 bg-primary/10 p-3">
          {t("season.summary.thanks", "Tack! Din utvärdering är inskickad.")}
        </p>
      )}

      <section aria-labelledby="numbers" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <EditableText as="h2" id="numbers" className="text-xl font-semibold" {...te("season.summary.numbers", "Säsongen i siffror")} />
          <Link href={`${base}/resultat`} className="inline-flex min-h-11 items-center text-sm underline">
            {t("season.summary.editResults", "Fyll i resultat")}
          </Link>
        </div>
        {totals.matches === null && totals.position === null ? (
          <EditableText
            as="p"
            className={`${card} text-muted`}
            {...te("season.summary.noResults", "Inga resultat ännu. Lägg in matcherna under Resultat, så räknas allt fram här.")}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label={t("season.summary.matches", "Matcher")}>{formatCount(totals.matches)}</Tile>
              {totals.fromMatchLog && (
                <Tile label={t("season.summary.wdl", "Vinst – oavgjort – förlust")}>
                  {record.won} – {record.drawn} – {record.lost}
                </Tile>
              )}
              <Tile label={t("season.summary.points", "Poäng")}>{formatCount(totals.points)}</Tile>
              {totals.fromMatchLog && (
                <Tile label={t("season.summary.ppm", "Poäng per match")}>{formatRateShort(record.pointsPerMatch)}</Tile>
              )}
              <Tile label={t("season.summary.goals", "Mål, gjorda – insläppta")}>
                {formatCount(totals.goalsFor)} – {formatCount(totals.goalsAgainst)}
              </Tile>
              {totals.fromMatchLog && (
                <Tile label={t("season.summary.cleanSheets", "Hållna nollor")}>{record.cleanSheets}</Tile>
              )}
              <Tile label={t("season.summary.position", "Slutplacering")}>{formatCount(totals.position)}</Tile>
            </div>

            {totals.fromMatchLog && splits(matches).length > 0 && (
              <Table
                caption={t("season.summary.splits", "Uppdelning")}
                head={[
                  t("season.summary.split", "Del"),
                  t("season.summary.matches", "Matcher"),
                  t("season.summary.points", "Poäng"),
                  t("season.summary.ppm", "Poäng per match"),
                  t("season.summary.goalsFor", "Gjorda"),
                  t("season.summary.goalsAgainst", "Insläppta"),
                  t("season.summary.goalDiff", "Målskillnad"),
                ]}
                rows={splits(matches).map((s) => [
                  t(`season.summary.split.${s.key}`, { home: "Hemma", away: "Borta", spring: "Vår", autumn: "Höst" }[s.key]),
                  s.record.played,
                  s.record.points,
                  formatRateShort(s.record.pointsPerMatch),
                  s.record.goalsFor,
                  s.record.goalsAgainst,
                  signed(s.record.goalsFor - s.record.goalsAgainst),
                ])}
              />
            )}
          </>
        )}

        {comparison && hasComparison && previous && (
          <Table
            caption={t("season.summary.compare", "Jämfört med {season}").replace("{season}", previous.label)}
            head={[
              "",
              previous.label,
              current.label,
              t("season.summary.change", "Förändring"),
            ]}
            rows={comparison.map((c) => [
              t(`season.summary.compare.${c.key}`, {
                position: "Slutplacering",
                matches: "Matcher",
                points: "Poäng",
                goalsFor: "Gjorda mål",
                goalsAgainst: "Insläppta mål",
              }[c.key]),
              formatCount(c.previous),
              formatCount(c.current),
              c.change === null ? "–" : signed(c.change),
            ])}
            note={t("season.summary.positionNote", "Lägre placering är bättre: −2 betyder två placeringar upp.")}
          />
        )}

        {goals.totals.scored + goals.totals.conceded > 0 && (
          <Table
            caption={t("season.summary.goalSources", "Hur kom målen?")}
            head={[
              t("season.summary.goalSource", "Typ"),
              t("season.summary.goalsFor", "Gjorda"),
              t("season.summary.share", "Andel"),
              t("season.summary.goalsAgainst", "Insläppta"),
              t("season.summary.share", "Andel"),
            ]}
            rows={goals.rows.map((g) => [
              sourceLabels[g.key],
              formatCount(g.scored),
              share(g.scoredShare),
              formatCount(g.conceded),
              share(g.concededShare),
            ])}
          />
        )}
      </section>

      <section aria-labelledby="evaluation" className="flex flex-col gap-3">
        <EditableText
          as="h2"
          id="evaluation"
          className="text-xl font-semibold"
          {...te("season.summary.evaluation", "Ledarnas bedömning")}
        />
        <p className="text-muted">
          {t("season.summary.submittedCount", "{done} av {total} ledare har skickat in sin utvärdering.")
            .replace("{done}", String(evaluations.length))
            .replace("{total}", String(memberCount ?? evaluations.length))}
        </p>

        {!submittedOwn ? (
          <div className={card}>
            <EditableText
              as="p"
              {...te(
                "season.summary.gate",
                "Fyll i din egen utvärdering först. Då ser du de andras när du har skickat in, så att ni inte påverkar varandra.",
              )}
            />
            <Link href={`${base}/min-utvardering`} className={`${buttonPrimary} mt-3`}>
              {t("season.summary.toMine", "Till min utvärdering")}
            </Link>
          </div>
        ) : (
          <Evaluation
            rows={summariseAreas(areas, evaluations)}
            evaluations={evaluations}
            nameOf={await leaderNames(
              context,
              evaluations.map((e) => e.leaderId),
              t("combined.you", "Du"),
              t("combined.leader", "Ledare"),
            )}
            nextLabel={nextLabel}
          />
        )}
      </section>

      <section className={card} aria-labelledby="next">
        <h2 id="next" className="text-lg font-semibold">
          {t("season.summary.nextTitle", "Inför {season}").replace("{season}", nextLabel)}
        </h2>
        <EditableText
          as="p"
          className="mt-1 text-muted"
          {...te(
            "season.summary.nextBody",
            "Gå igenom sammanställningen tillsammans och skriv besluten i planeringen: högst tre förbättringsområden, truppen ni vill ha och vilka ni vill värva.",
          )}
        />
        {following ? (
          <Link href={`/klubb/${clubId}/sasong/${following.id}/planering`} className={`${buttonPrimary} mt-3`}>
            {t("season.summary.toPlan", "Planera {season}").replace("{season}", following.label)}
          </Link>
        ) : (
          <Link href={`/klubb/${clubId}/sasong`} className="mt-3 inline-flex min-h-11 items-center underline">
            {context.role === "admin"
              ? t("season.summary.createNext", "Lägg till säsongen {season} för att planera den").replace("{season}", nextLabel)
              : t("season.summary.askAdmin", "Be en admin lägga till säsongen {season}").replace("{season}", nextLabel)}
          </Link>
        )}
      </section>
    </>
  );
}

function Evaluation({
  rows,
  evaluations,
  nameOf,
  nextLabel,
}: {
  rows: AreaSummary[];
  evaluations: Awaited<ReturnType<typeof loadSubmittedEvaluations>>;
  nameOf: (leaderId: string, index: number) => string;
  nextLabel: string;
}) {
  const groups = groupAverages(rows);
  const { strongest, weakest } = strongestAndWeakest(rows);
  const outlook = summariseOutlook(evaluations);
  const disagreeLabel = t("season.summary.disagree", "Oeniga – diskutera");
  const prioritiseLabel = t("season.summary.prioritise", "Prioritera?");
  const indexOf = (leaderId: string) => evaluations.findIndex((e) => e.leaderId === leaderId);
  const commented = rows.filter((r) => r.comments.length > 0);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label={t("season.summary.overall", "Snitt, alla områden")}>
          <Score value={overallAverage(rows)} />
        </Tile>
        <TopList title={t("season.summary.strongest", "Starkast")} rows={strongest} />
        <TopList title={t("season.summary.weakest", "Svagast")} rows={weakest} />
      </div>

      <Table
        caption={t("season.summary.groups", "Snitt per del")}
        head={[t("season.summary.group", "Del"), t("season.summary.average", "Snitt")]}
        rows={groups.map((g) => [g.group, <Score key={g.group} value={g.average} />])}
      />

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="p-3 text-left font-semibold">
            {t("season.summary.areas", "Per område")}
            <span className="block text-sm font-normal text-muted">
              {t("season.summary.areasHint", "Färgen följer snittet. Siffran gäller alltid, färgen är bara stöd.")}
            </span>
          </caption>
          <thead className="bg-surface-muted">
            <tr>
              <th className="p-2">{t("season.summary.area", "Område")}</th>
              <th className="p-2">{t("season.summary.average", "Snitt")}</th>
              <th className="p-2">{t("season.summary.range", "Lägst–högst")}</th>
              <th className="p-2">{t("season.summary.answers", "Svar")}</th>
              <th className="p-2">{t("season.summary.tooLittle", "Tränat för lite")}</th>
              <th className="p-2">
                <span className="sr-only">{t("season.summary.flags", "Markeringar")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.area.id} className="border-t border-border">
                <th scope="row" className="p-2 font-normal">
                  {(i === 0 || rows[i - 1].area.groupName !== r.area.groupName) && (
                    <span className="block text-xs text-muted">{r.area.groupName}</span>
                  )}
                  {r.area.name}
                </th>
                <td className="p-2">
                  <Score value={r.average} />
                </td>
                <td className="p-2">{r.min === null ? "–" : `${r.min}–${r.max}`}</td>
                <td className="p-2">{r.answers}</td>
                <td className="p-2">{r.tooLittle || "–"}</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    {r.disagree && <Flag>{disagreeLabel}</Flag>}
                    {r.prioritise && <Flag>{prioritiseLabel}</Flag>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {commented.length > 0 && (
        <details className={card}>
          <summary className="min-h-11 cursor-pointer font-semibold">
            {t("season.summary.comments", "Kommentarer per område")}
          </summary>
          <dl className="mt-2 flex flex-col gap-3">
            {commented.map((r) => (
              <div key={r.area.id}>
                <dt className="font-medium">{r.area.name}</dt>
                {r.comments.map((c, i) => (
                  <dd key={i} className="text-sm">
                    <span className="text-muted">{nameOf(c.leaderId, indexOf(c.leaderId))}:</span> {c.text}
                  </dd>
                ))}
              </div>
            ))}
          </dl>
        </details>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <LeaderList
          title={t("season.summary.strengths", "Styrkor")}
          items={evaluations.map((e, i) => ({ who: nameOf(e.leaderId, i), texts: e.strengths }))}
          empty={t("season.summary.none", "Inget ifyllt.")}
        />
        <LeaderList
          title={t("season.summary.weaknesses", "Svagheter")}
          items={evaluations.map((e, i) => ({ who: nameOf(e.leaderId, i), texts: e.weaknesses }))}
          empty={t("season.summary.none", "Inget ifyllt.")}
        />
      </div>

      <div className={card}>
        <h3 className="font-semibold">
          {t("season.summary.outlook", "Framåt: hur bra är vi {season}?").replace("{season}", nextLabel)}
        </h3>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted">{t("season.summary.outlookLevel", "Nivå jämfört med serien (1–10)")}</dt>
            <dd>
              <Score value={outlook.level.average} />{" "}
              {outlook.level.answers > 1 && (
                <span className="text-sm text-muted">
                  ({outlook.level.min}–{outlook.level.max})
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">
              {t("season.summary.outlookPosition", "Placering om vi inte ändrar något")}
            </dt>
            <dd className="font-semibold">
              {formatScore(outlook.position.average)}{" "}
              {outlook.position.answers > 1 && (
                <span className="text-sm font-normal text-muted">
                  ({outlook.position.min}–{outlook.position.max})
                </span>
              )}
            </dd>
          </div>
        </dl>
        {outlook.keyFactors.length > 0 && (
          <>
            <h4 className="mt-3 text-sm font-medium">
              {t("season.summary.keyFactors", "Det viktigaste som avgör")}
            </h4>
            <ul className="mt-1 flex flex-col gap-1 text-sm">
              {outlook.keyFactors.map((k) => (
                <li key={k.leaderId}>
                  <span className="text-muted">{nameOf(k.leaderId, indexOf(k.leaderId))}:</span> {k.text}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}

function share(value: number | null): string {
  return value === null ? "–" : `${Math.round(value * 100)} %`;
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <span className="block text-sm text-muted">{label}</span>
      <span className="text-2xl font-bold">{children}</span>
    </div>
  );
}

/** A 1–10 average with its colour; the number is always shown. */
function Score({ value }: { value: number | null }) {
  return (
    <span className="inline-flex items-center gap-2">
      {value !== null && (
        <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ background: scaleColor(attributeT(value)) }} />
      )}
      <span className="font-semibold">{formatScore(value)}</span>
    </span>
  );
}

function Flag({ children }: { children: ReactNode }) {
  return <span className="whitespace-nowrap rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 text-xs">{children}</span>;
}

function TopList({ title, rows }: { title: string; rows: AreaSummary[] }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <h3 className="text-sm text-muted">{title}</h3>
      <ol className="mt-1 flex flex-col gap-1">
        {rows.map((r) => (
          <li key={r.area.id} className="flex justify-between gap-2">
            <span>{r.area.name}</span>
            <Score value={r.average} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function LeaderList({ title, items, empty }: { title: string; items: { who: string; texts: string[] }[]; empty: string }) {
  const filled = items.filter((i) => i.texts.some(Boolean));
  return (
    <div className={card}>
      <h3 className="font-semibold">{title}</h3>
      {filled.length === 0 ? (
        <p className="mt-1 text-sm text-muted">{empty}</p>
      ) : (
        <dl className="mt-2 flex flex-col gap-2">
          {filled.map((i, n) => (
            <div key={n}>
              <dt className="text-sm text-muted">{i.who}</dt>
              {i.texts.filter(Boolean).map((text, k) => (
                <dd key={k}>{text}</dd>
              ))}
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function Table({
  caption,
  head,
  rows,
  note,
}: {
  caption: string;
  head: string[];
  rows: ReactNode[][];
  note?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <caption className="p-3 text-left font-semibold">{caption}</caption>
        <thead className="bg-surface-muted">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="p-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border">
              {row.map((cell, k) =>
                k === 0 ? (
                  <th key={k} scope="row" className="p-2 font-normal">
                    {cell}
                  </th>
                ) : (
                  <td key={k} className="p-2">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {note && <p className="px-3 pb-3 text-sm text-muted">{note}</p>}
    </div>
  );
}
