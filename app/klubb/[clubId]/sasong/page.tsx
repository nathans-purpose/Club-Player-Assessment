import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { EditableText } from "@/components/text-edit";
import { type ClubContext, loadPlayers, requireClubMember } from "@/lib/assessment/data";
import { APP_NAME } from "@/lib/config";
import { formatCount, formatRateShort } from "@/lib/format";
import { t, te } from "@/lib/i18n";
import { positionLabels } from "@/lib/season/copy";
import {
  loadAreas,
  loadMatches,
  loadPlan,
  loadReview,
  loadSeasons,
  loadSubmittedEvaluations,
  type Season,
} from "@/lib/season/data";
import { MAX_PRIORITIES, type PlanOverview, type PlanStep, planOverview, seasonsByTime } from "@/lib/season/overview";
import {
  matchRecord,
  nextSeasonLabel,
  overallAverage,
  seasonTotals,
  strongestAndWeakest,
  suggestedPriorities,
  summariseAreas,
} from "@/lib/season/summary";
import { CreateSeason } from "./create-season";
import { Score, Tile } from "./parts";
import { buttonPrimary, card } from "./ui";

export const metadata: Metadata = { title: `Säsong – ${APP_NAME}` };

type Props = PageProps<"/klubb/[clubId]/sasong">;
type Supabase = ClubContext["supabase"];

// Säsong: an overview of the season now (results and the leaders'
// evaluation), the coming seasons' plans and the seasons behind.
export default function SeasonsPage({ params }: Props) {
  return (
    <Suspense fallback={<p className="text-muted">{t("common.loading", "Laddar …")}</p>}>
      <Seasons params={params} />
    </Suspense>
  );
}

async function Seasons({ params }: Pick<Props, "params">) {
  const { clubId } = await params;
  const { supabase, userId, role, club, team } = await requireClubMember(clubId);
  const seasons = team ? await loadSeasons(supabase, team.id) : [];
  const { current, upcoming, past } = seasonsByTime(seasons);
  const { data: mine } = seasons.length
    ? await supabase
        .from("season_evaluations")
        .select("season_id, status")
        .eq("leader_id", userId)
        .in(
          "season_id",
          seasons.map((s) => s.id),
        )
    : { data: [] };
  const statusOf = new Map((mine ?? []).map((e) => [e.season_id as string, e.status as "draft" | "submitted"]));
  const latest = seasons.at(-1)?.label ?? String(new Date().getFullYear());
  return (
    <>
      <div>
        <p className="text-sm text-muted">
          {club.name}
          {team && ` · ${team.name}`}
        </p>
        <EditableText as="h1" className="mt-1 text-2xl font-bold" {...te("season.title", "Säsong")} />
        <EditableText
          as="p"
          className="mt-2 max-w-prose text-muted"
          {...te(
            "season.intro",
            "Utvärdera hur säsongen gick som lag: resultat, taktik och träning. Planera sedan nästa säsong tillsammans i ledargruppen: strategi, trupp och värvningar. Spelarna ser inget av det här.",
          )}
        />
      </div>

      {current && team && (
        <CurrentSeason
          supabase={supabase}
          clubId={clubId}
          teamId={team.id}
          season={current}
          status={statusOf.get(current.id)}
          userId={userId}
        />
      )}

      <section aria-labelledby="upcoming" className="flex flex-col gap-3">
        <EditableText
          as="h2"
          id="upcoming"
          className="text-xl font-semibold"
          {...te("season.overview.upcoming", "Kommande säsonger")}
        />
        {team && upcoming.length > 0 ? (
          <UpcomingSeasons supabase={supabase} clubId={clubId} teamId={team.id} seasons={upcoming} />
        ) : (
          <EditableText
            as="p"
            className="text-muted"
            {...te(
              "season.overview.noUpcoming",
              "Ingen kommande säsong ännu. Lägg till nästa säsong för att börja planera strategi, trupp och värvningar.",
            )}
          />
        )}
        {role === "admin" && team ? (
          <CreateSeason
            clubId={clubId}
            suggestion={nextSeasonLabel(latest)}
            copy={{
              title: t("season.create.title", "Lägg till säsong"),
              hint: t(
                "season.create.hint",
                "Lägg till nästa säsong för att planera den, eller förra säsongen för att kunna jämföra. Den aktiva säsongen, som spelarna bedöms i, ändras inte.",
              ),
              label: t("season.create.label", "Säsong"),
              submit: t("season.create.submit", "Lägg till"),
              saving: t("common.saving", "Sparar …"),
            }}
          />
        ) : (
          <EditableText
            as="p"
            className="text-sm text-muted"
            {...te("season.create.leader", "En admin kan lägga till nästa säsong, så att ni kan planera den.")}
          />
        )}
      </section>

      {current && past.length > 0 && <History supabase={supabase} clubId={clubId} seasons={[current, ...past]} />}
    </>
  );
}

/** The season now: its numbers, how far the evaluation has got and what it says. */
async function CurrentSeason({
  supabase,
  clubId,
  teamId,
  season,
  status,
  userId,
}: {
  supabase: Supabase;
  clubId: string;
  teamId: string;
  season: Season;
  status: "draft" | "submitted" | undefined;
  userId: string;
}) {
  const [matches, review, evaluations, areas, { count: memberCount }, { data: plan }] = await Promise.all([
    loadMatches(supabase, season.id),
    loadReview(supabase, season.id),
    loadSubmittedEvaluations(supabase, season.id),
    loadAreas(supabase, teamId),
    supabase.from("club_members").select("user_id", { count: "exact", head: true }).eq("club_id", clubId),
    supabase.from("season_plans").select("goal").eq("season_id", season.id).maybeSingle(),
  ]);
  const totals = seasonTotals(matches, review);
  const record = matchRecord(matches);
  const submittedOwn = evaluations.some((e) => e.leaderId === userId);
  const rows = submittedOwn ? summariseAreas(areas, evaluations) : [];
  const { strongest, weakest } = strongestAndWeakest(rows);
  const suggestions = suggestedPriorities(rows);
  const base = `/klubb/${clubId}/sasong/${season.id}`;
  const hasResults = totals.matches !== null || totals.position !== null;

  return (
    <section aria-labelledby="now" className={`${card} flex flex-col gap-4`}>
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 id="now" className="text-xl font-semibold">
            {t("season.label", "Säsong {label}").replace("{label}", season.label)}
          </h2>
          {season.isActive && (
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-sm">{t("season.active", "Aktiv säsong")}</span>
          )}
        </div>
        {plan?.goal?.trim() && (
          <p className="mt-1">
            <span className="text-muted">{t("season.overview.goal", "Målsättning")}:</span> {plan.goal}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">{t("season.overview.results", "Resultat")}</h3>
        {hasResults ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label={t("season.summary.position", "Slutplacering")}>{formatCount(totals.position)}</Tile>
            <Tile label={t("season.summary.points", "Poäng")}>{formatCount(totals.points)}</Tile>
            {totals.fromMatchLog ? (
              <Tile label={t("season.summary.wdl", "Vinst – oavgjort – förlust")}>
                {record.won} – {record.drawn} – {record.lost}
              </Tile>
            ) : (
              <Tile label={t("season.summary.matches", "Matcher")}>{formatCount(totals.matches)}</Tile>
            )}
            <Tile label={t("season.summary.goals", "Mål, gjorda – insläppta")}>
              {formatCount(totals.goalsFor)} – {formatCount(totals.goalsAgainst)}
            </Tile>
          </div>
        ) : (
          <p className="text-muted">
            {t("season.overview.noResults", "Inga resultat ännu.")}{" "}
            <Link href={`${base}/resultat`} className="underline">
              {t("season.summary.editResults", "Fyll i resultat")}
            </Link>
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">{t("season.summary.evaluation", "Ledarnas bedömning")}</h3>
        <p className="text-muted">
          {t("season.summary.submittedCount", "{done} av {total} ledare har skickat in sin utvärdering.")
            .replace("{done}", String(evaluations.length))
            .replace("{total}", String(memberCount ?? evaluations.length))}{" "}
          {status === "submitted"
            ? t("season.myStatus.submitted", "Din utvärdering är inskickad")
            : status === "draft"
              ? t("season.myStatus.draft", "Din utvärdering är ett utkast")
              : t("season.myStatus.none", "Du har inte utvärderat")}
          .
        </p>
        {!submittedOwn ? (
          <div>
            <EditableText
              as="p"
              {...te(
                "season.overview.gate",
                "När du har skickat in din egen utvärdering ser du här vad ledarna tycker är starkast och svagast.",
              )}
            />
            <Link href={`${base}/min-utvardering`} className={`${buttonPrimary} mt-3`}>
              {t("season.summary.toMine", "Till min utvärdering")}
            </Link>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Tile label={t("season.summary.overall", "Snitt, alla områden")}>
                <Score value={overallAverage(rows)} />
              </Tile>
              <AreaList title={t("season.summary.strongest", "Starkast")} rows={strongest} />
              <AreaList title={t("season.summary.weakest", "Svagast")} rows={weakest} />
            </div>
            {suggestions.length > 0 && (
              <p>
                <span className="text-muted">
                  {t("season.overview.suggested", "Förslag på förbättringsområden inför nästa säsong")}:
                </span>{" "}
                {suggestions.map((r) => r.area.name).join(", ")}
              </p>
            )}
          </>
        )}
      </div>

      <nav
        aria-label={t("season.overview.links", "Mer om säsong {label}").replace("{label}", season.label)}
        className="flex flex-wrap gap-x-4"
      >
        <Link className="inline-flex min-h-11 items-center underline" href={base}>
          {t("season.overview.toSummary", "Hela sammanställningen")}
        </Link>
        <Link className="inline-flex min-h-11 items-center underline" href={`${base}/resultat`}>
          {t("season.tab.results", "Resultat")}
        </Link>
        <Link className="inline-flex min-h-11 items-center underline" href={`${base}/planering`}>
          {t("season.tab.plan", "Planering")}
        </Link>
      </nav>
    </section>
  );
}

function AreaList({ title, rows }: { title: string; rows: ReturnType<typeof summariseAreas> }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <h4 className="text-sm text-muted">{title}</h4>
      {rows.length === 0 ? (
        <p className="mt-1 text-sm text-muted">–</p>
      ) : (
        <ol className="mt-1 flex flex-col gap-1">
          {rows.map((r) => (
            <li key={r.area.id} className="flex justify-between gap-2">
              <span>{r.area.name}</span>
              <Score value={r.average} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const STEP_LABELS: Record<PlanStep, string> = {
  strategy: "Målsättning och strategi",
  priorities: "Förbättringsområden",
  squad: "Önskad trupp",
  decisions: "Besked för varje spelare",
  recruits: "Värvningsönskemål",
};

/** Each coming season: how far its plan has got and what it says so far. */
async function UpcomingSeasons({
  supabase,
  clubId,
  teamId,
  seasons,
}: {
  supabase: Supabase;
  clubId: string;
  teamId: string;
  seasons: Season[];
}) {
  const [players, plans] = await Promise.all([
    loadPlayers(supabase, teamId),
    Promise.all(seasons.map((s) => loadPlan(supabase, s.id))),
  ]);
  const playerIds = players.map((p) => p.id);
  const positions = positionLabels();

  return (
    <ol className="flex flex-col gap-3" aria-label={t("season.overview.upcoming", "Kommande säsonger")}>
      {seasons.map((season, i) => {
        const plan = plans[i];
        const overview = planOverview(plan, playerIds);
        return (
          <li key={season.id} className={`${card} flex flex-col gap-4`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold">
                {t("season.label", "Säsong {label}").replace("{label}", season.label)}
              </h3>
              <span className="text-sm text-muted">
                {t("season.overview.progress", "{done} av {total} delar klara")
                  .replace("{done}", String(overview.done))
                  .replace("{total}", String(overview.steps.length))}
              </span>
            </div>

            <ul className="grid gap-1 sm:grid-cols-2" aria-label={t("season.overview.steps", "Planens delar")}>
              {overview.steps.map((step) => (
                <li key={step.key} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs ${step.done ? "bg-primary text-on-primary" : "border border-border"}`}
                  >
                    {step.done ? "✓" : ""}
                  </span>
                  <span>
                    {t(`season.overview.step.${step.key}`, STEP_LABELS[step.key])}
                    <span className="sr-only">
                      {": "}
                      {step.done ? t("season.overview.done", "klart") : t("season.overview.notDone", "inte klart")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            {(plan.plan.goal || plan.plan.strategy || plan.plan.formation) && (
              <dl className="grid gap-2 sm:grid-cols-3">
                {plan.plan.goal && <Fact label={t("season.overview.goal", "Målsättning")}>{plan.plan.goal}</Fact>}
                {plan.plan.formation && (
                  <Fact label={t("season.overview.formation", "Spelsystem")}>{plan.plan.formation}</Fact>
                )}
                {plan.plan.strategy && (
                  <Fact label={t("season.overview.strategy", "Strategi")} wide>
                    <span className="line-clamp-3 whitespace-pre-line">{plan.plan.strategy}</span>
                  </Fact>
                )}
              </dl>
            )}

            {plan.priorities.length > 0 && (
              <div>
                <h4 className="text-sm text-muted">
                  {t("season.overview.priorities", "Förbättringsområden ({count} av högst {max})")
                    .replace("{count}", String(plan.priorities.length))
                    .replace("{max}", String(MAX_PRIORITIES))}
                </h4>
                <ol className="mt-1 flex list-decimal flex-col gap-1 pl-5">
                  {plan.priorities.map((p) => (
                    <li key={p.id}>
                      <span className="font-medium">{p.area}</span>
                      {p.action && <span className="text-muted"> – {p.action}</span>}
                      {p.owner && (
                        <span className="text-sm text-muted">
                          {" "}
                          ({t("season.overview.owner", "ansvarig: {owner}").replace("{owner}", p.owner)})
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <SquadSummary overview={overview} positions={positions} />

            <Link href={`/klubb/${clubId}/sasong/${season.id}/planering`} className={`${buttonPrimary} self-start`}>
              {t("season.summary.toPlan", "Planera {season}").replace("{season}", season.label)}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

function SquadSummary({ overview, positions }: { overview: PlanOverview; positions: ReturnType<typeof positionLabels> }) {
  const { squad, gaps, recruits } = overview;
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm text-muted">{t("season.overview.squad", "Truppen")}</h4>
      {squad.saved ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label={t("season.overview.wanted", "Önskat antal")}>{squad.wanted}</Tile>
          <Tile label={t("season.overview.secure", "Klara")}>{squad.secure}</Tile>
          <Tile label={t("season.overview.uncertain", "Osäkra")}>{squad.uncertain}</Tile>
          <Tile label={t("season.overview.missing", "Saknas")}>{squad.missing}</Tile>
        </div>
      ) : (
        <p className="text-muted">{t("season.overview.noSquad", "Ingen önskad trupp sparad än.")}</p>
      )}
      {gaps.length > 0 && (
        <p>
          <span className="text-muted">{t("season.overview.gaps", "Luckor")}:</span>{" "}
          {gaps
            .map((g) =>
              (g.inProgress > 0
                ? t("season.overview.gapWithRecruits", "{missing} {position} ({recruits} på gång)")
                : t("season.overview.gap", "{missing} {position}")
              )
                .replace("{missing}", String(g.missing))
                .replace("{position}", positions[g.code].toLowerCase())
                .replace("{recruits}", String(g.inProgress)),
            )
            .join(", ")}
        </p>
      )}
      <p className="text-sm text-muted">
        {t("season.overview.decided", "{decided} av {players} spelare har fått besked, {leaving} slutar.")
          .replace("{decided}", String(overview.decided))
          .replace("{players}", String(overview.players))
          .replace("{leaving}", String(overview.leaving))}{" "}
        {t(
          "season.overview.recruits",
          "Värvningar: {inProgress} på gång ({high} hög prioritet), {signed} klara, {declined} har tackat nej.",
        )
          .replace("{inProgress}", String(recruits.inProgress))
          .replace("{high}", String(recruits.highPriority))
          .replace("{signed}", String(recruits.signed))
          .replace("{declined}", String(recruits.declined))}
      </p>
    </div>
  );
}

function Fact({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? "sm:col-span-3" : undefined}>
      <dt className="text-sm text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** The season now and the ones behind it, newest first, side by side. */
async function History({ supabase, clubId, seasons }: { supabase: Supabase; clubId: string; seasons: Season[] }) {
  const base = `/klubb/${clubId}/sasong`;
  const rows = await Promise.all(
    seasons.map(async (s) => {
      const [matches, review] = await Promise.all([loadMatches(supabase, s.id), loadReview(supabase, s.id)]);
      const totals = seasonTotals(matches, review);
      return {
        season: s,
        totals,
        ppm: totals.matches && totals.points !== null ? totals.points / totals.matches : null,
      };
    }),
  );
  return (
    <section aria-labelledby="history" className="flex flex-col gap-3">
      <EditableText as="h2" id="history" className="text-xl font-semibold" {...te("season.overview.history", "Säsong för säsong")} />
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{t("season.overview.history", "Säsong för säsong")}</caption>
          <thead className="bg-surface-muted">
            <tr>
              <th className="p-2">{t("season.overview.season", "Säsong")}</th>
              <th className="p-2">{t("season.summary.position", "Slutplacering")}</th>
              <th className="p-2">{t("season.summary.matches", "Matcher")}</th>
              <th className="p-2">{t("season.summary.points", "Poäng")}</th>
              <th className="p-2">{t("season.summary.ppm", "Poäng per match")}</th>
              <th className="p-2">{t("season.overview.goalsShort", "Mål")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ season, totals, ppm }) => (
              <tr key={season.id} className="border-t border-border">
                <th scope="row" className="p-2 font-normal">
                  <Link className="inline-flex min-h-11 items-center underline" href={`${base}/${season.id}`}>
                    {season.label}
                  </Link>
                </th>
                <td className="p-2">{formatCount(totals.position)}</td>
                <td className="p-2">{formatCount(totals.matches)}</td>
                <td className="p-2">{formatCount(totals.points)}</td>
                <td className="p-2">{formatRateShort(ppm)}</td>
                <td className="p-2">
                  {formatCount(totals.goalsFor)} – {formatCount(totals.goalsAgainst)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
