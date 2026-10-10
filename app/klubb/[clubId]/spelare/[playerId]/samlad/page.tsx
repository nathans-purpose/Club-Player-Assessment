import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { levelBackground, Pitch, pitchSpotStyle } from "@/components/pitch";
import {
  ASSESSMENT_SELECT,
  type AssessmentRow,
  isUuid,
  loadCategories,
  loadPhases,
  loadPositionTargets,
  requireClubMember,
  toCalcAssessment,
} from "@/lib/assessment/data";
import {
  attributeT,
  isLowAttendance,
  type LeaderScore,
  phaseAttendance,
  scaleColor,
  type ScoreSummary,
  summarizePlayer,
  summarizePositions,
} from "@/lib/calc";
import { APP_NAME } from "@/lib/config";
import { formatPercent, formatScore } from "@/lib/format";
import { t } from "@/lib/i18n";
import { SQUAD_GROUP_LABELS, type SquadGroup } from "@/lib/players/squad-groups";
import { POSITION_CODES, POSITION_LABELS, POSITION_LEVEL_LABELS, type PositionCode } from "@/lib/positions";

export const metadata: Metadata = { title: `Samlad bedömning – ${APP_NAME}` };

// The combined view of one player. A leader sees it only after submitting
// their own assessment of the player, so they are not swayed beforehand.
export default function CombinedPage({ params }: PageProps<"/klubb/[clubId]/spelare/[playerId]/samlad">) {
  return (
    <Suspense fallback={<p className="text-muted">{t("common.loading", "Laddar …")}</p>}>
      <Combined params={params} />
    </Suspense>
  );
}

async function Combined({ params }: Pick<PageProps<"/klubb/[clubId]/spelare/[playerId]/samlad">, "params">) {
  const { clubId, playerId } = await params;
  const { supabase, userId, club, team, season } = await requireClubMember(clubId);
  // The club can hide who gave which score; then only averages and spread show.
  const anonymous = club.anonymousLeaderView;
  if (!team || !season || !isUuid(playerId)) notFound();

  const [{ data: player }, categories, phases, targets, { data: rows }] = await Promise.all([
    supabase
      .from("players")
      .select("id, shirt_number, full_name, squad_group")
      .eq("id", playerId)
      .eq("team_id", team.id)
      .maybeSingle(),
    loadCategories(supabase, team.id),
    loadPhases(supabase, season.id),
    loadPositionTargets(supabase, team.id),
    supabase
      .from("assessments")
      .select(ASSESSMENT_SELECT)
      .eq("season_id", season.id)
      .eq("player_id", playerId)
      .eq("status", "submitted")
      .order("submitted_at")
      .returns<AssessmentRow[]>(),
  ]);
  if (!player) notFound();

  const assessments = rows ?? [];
  const cardHref = `/klubb/${clubId}/spelare/${playerId}`;
  if (!assessments.some((a) => a.leader_id === userId)) redirect(cardHref);

  const { data: profiles } = anonymous
    ? { data: [] }
    : await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in(
          "id",
          assessments.map((a) => a.leader_id),
        );
  const you = t("combined.you", "Du");
  const nameOf = (leaderId: string) => {
    if (leaderId === userId) return you;
    const profile = profiles?.find((p) => p.id === leaderId);
    return profile?.full_name || profile?.email?.split("@")[0] || t("combined.leader", "Ledare");
  };

  const calc = assessments.map(toCalcAssessment);
  const summary = summarizePlayer(categories.all, calc);
  const positions = summarizePositions(calc);
  const leaders = summary.submittedCount;
  const squadGroup = player.squad_group as SquadGroup | null;
  const disagreements = summary.categories.filter((c) => c.disagreement).length;

  const levelLabel = (level: 1 | 2 | 3) => t(`positionLevel.${level}`, POSITION_LEVEL_LABELS[level]);
  const positionLabel = (code: PositionCode) => t(`position.${code}`, POSITION_LABELS[code]);
  const positionByCode = new Map(positions.map((p) => [p.code, p]));
  const pitchCodes = POSITION_CODES.filter((code) => positionByCode.has(code) || targets.some((p) => p.code === code));
  const comments = assessments.filter((a) => a.comment);
  const spreadLabel = t("combined.spread", "Spridning {min}–{max}");

  return (
    <>
      <div>
        <div className="flex flex-wrap gap-x-4">
          <Link href={`/klubb/${clubId}/spelare`} className="inline-flex min-h-11 items-center text-sm underline">
            {t("card.back", "← Alla spelare")}
          </Link>
          <Link href={cardHref} className="inline-flex min-h-11 items-center text-sm underline">
            {t("combined.yourAssessment", "Din bedömning")}
          </Link>
        </div>
        <p className="text-sm text-muted">{t("combined.kicker", "Samlad bedömning")}</p>
        <h1 className="text-2xl font-bold">
          {player.shirt_number && <span className="mr-2 font-mono text-muted">{player.shirt_number}</span>}
          {player.full_name}
        </h1>
        <p className="mt-1 text-muted">
          {[squadGroup ? t(`squadGroup.${squadGroup}`, SQUAD_GROUP_LABELS[squadGroup]) : null, season.label]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <section aria-labelledby="totals-heading" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <h2 id="totals-heading" className="sr-only">
          {t("combined.totals", "Sammanfattning")}
        </h2>
        <Tile label={t("combined.total", "Totalt snitt")}>
          <ScoreValue value={summary.totalAverage} large />
        </Tile>
        <Tile label={t("combined.assessments", "Bedömningar")}>
          <span className="text-2xl font-bold">{leaders}</span>
          {summary.fewAssessments && (
            <span className="mt-1 block text-sm text-muted">{t("combined.few", "få bedömningar")}</span>
          )}
        </Tile>
        <Tile label={t("combined.mainPosition", "Huvudposition")}>
          <span className="text-lg font-bold">{positions[0] ? positionLabel(positions[0].code) : "–"}</span>
        </Tile>
        <Tile label={t("combined.disagreements", "Oeniga")}>
          <span className="text-2xl font-bold">{disagreements}</span>
          {disagreements > 0 && (
            <span className="mt-1 block text-sm text-muted">
              {t("combined.disagreementsHint", "kategorier att diskutera")}
            </span>
          )}
        </Tile>
      </section>

      <section aria-labelledby="positions-heading" className="flex flex-col gap-3">
        <h2 id="positions-heading" className="text-lg font-semibold">
          {t("combined.positions", "Positioner")}
        </h2>
        <p className="text-sm text-muted">
          {t("combined.positionsHint", "Färgen visar snittnivån. Siffran visar hur många ledare som valde positionen.")}
        </p>
        <Pitch label={t("combined.pitch", "Positioner på planen")}>
          {pitchCodes.map((code) => {
            const p = positionByCode.get(code);
            return (
              <span
                key={code}
                aria-hidden="true"
                style={{ ...pitchSpotStyle(code), background: levelBackground(p?.level) }}
                className={`absolute flex size-11 flex-col items-center justify-center rounded-full border-2 text-xs font-bold leading-none ${
                  p ? "border-white text-foreground shadow-md" : "border-white/50 text-white/70"
                }`}
              >
                {code}
                {p && (
                  <span className="mt-0.5 text-[10px] font-semibold">
                    {p.count}/{leaders}
                  </span>
                )}
              </span>
            );
          })}
        </Pitch>
        {positions.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm">
            {positions.map((p) => (
              <li key={p.code} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-full border border-border"
                  style={{ background: levelBackground(p.level) }}
                />
                <span>
                  <span className="font-medium">{positionLabel(p.code)}</span>: {levelLabel(p.level)} (
                  {t("combined.positionCount", "{count} av {total} ledare")
                    .replace("{count}", String(p.count))
                    .replace("{total}", String(leaders))}
                  )
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("combined.noPositions", "Inga positioner valda.")}</p>
        )}
      </section>

      {phases.length > 0 && (
        <section aria-labelledby="attendance-heading" className="flex flex-col gap-3">
          <h2 id="attendance-heading" className="text-lg font-semibold">
            {t("combined.attendance", "Träningsnärvaro")}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {phases.map((phase) => {
              const value = phaseAttendance(calc, phase.id);
              const low = isLowAttendance(value);
              return (
                <li
                  key={phase.id}
                  className={`rounded-lg border p-3 ${low ? "border-danger/50 bg-danger/10" : "border-border bg-surface"}`}
                >
                  <span className="block text-sm text-muted">{phase.name}</span>
                  <span className="text-xl font-bold">{formatPercent(value)}</span>
                  {low && <span className="ml-2 text-sm font-medium text-danger">{t("combined.lowAttendance", "Låg")}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="categories-heading" className="flex flex-col gap-3">
        <h2 id="categories-heading" className="text-lg font-semibold">
          {t("combined.categories", "Betyg")}
        </h2>
        <ul className="flex flex-col gap-3">
          {summary.categories.map((c) => {
            const category = categories.all.find((x) => x.id === c.categoryId)!;
            return (
              <li key={c.categoryId} className="rounded-lg border border-border bg-surface p-4">
                <ScoreRow
                  title={category.name}
                  summary={c}
                  nameOf={nameOf}
                  userId={userId}
                  flag={t("combined.disagreement", "Oeniga – diskutera")}
                  spreadLabel={anonymous ? spreadLabel : null}
                  heading
                />
                {c.subcategories.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
                    {c.subcategories.map((s) => (
                      <li key={s.subcategoryId}>
                        <ScoreRow
                          title={category.subcategories.find((x) => x.id === s.subcategoryId)!.name}
                          summary={s}
                          nameOf={nameOf}
                          userId={userId}
                          flag={t("combined.disagreement", "Oeniga – diskutera")}
                          spreadLabel={anonymous ? spreadLabel : null}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="comments-heading" className="flex flex-col gap-3">
        <h2 id="comments-heading" className="text-lg font-semibold">
          {t("combined.comments", "Kommentarer")}
        </h2>
        {comments.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {comments.map((a) => (
              <li key={a.id} className="rounded-lg border border-border bg-surface p-3">
                <p className="whitespace-pre-line">{a.comment}</p>
                {!anonymous && <p className="mt-1 text-sm text-muted">{nameOf(a.leader_id)}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("combined.noComments", "Inga kommentarer.")}</p>
        )}
      </section>
    </>
  );
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <span className="block text-sm text-muted">{label}</span>
      {children}
    </div>
  );
}

/** A score with its colour; the number is always shown. */
function ScoreValue({ value, large = false }: { value: number | null; large?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      {value !== null && (
        <span
          aria-hidden="true"
          className="size-3 shrink-0 rounded-full"
          style={{ background: scaleColor(attributeT(value)) }}
        />
      )}
      <span className={large ? "text-2xl font-bold" : "font-semibold"}>{formatScore(value)}</span>
    </span>
  );
}

function ScoreRow({
  title,
  summary,
  nameOf,
  userId,
  flag,
  spreadLabel,
  heading = false,
}: {
  title: string;
  summary: ScoreSummary;
  nameOf: (leaderId: string) => string;
  userId: string;
  flag: string;
  /** Set in the anonymous leader view: the spread replaces the per-leader chips. */
  spreadLabel: string | null;
  heading?: boolean;
}) {
  // The leader's own score first, then the others in submission order.
  const chips: LeaderScore[] = [
    ...summary.perLeader.filter((p) => p.leaderId === userId),
    ...summary.perLeader.filter((p) => p.leaderId !== userId),
  ];
  const Title = heading ? "h3" : "p";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Title className={heading ? "font-semibold" : "text-sm font-medium"}>{title}</Title>
        <span className="flex items-center gap-2">
          {summary.disagreement && (
            <span className="rounded-full border border-scale-mid bg-scale-mid/20 px-2 py-0.5 text-xs font-semibold">
              {flag}
            </span>
          )}
          <ScoreValue value={summary.average} />
        </span>
      </div>
      {spreadLabel !== null ? (
        chips.length > 1 && (
          <p className="text-sm text-muted">
            {spreadLabel
              .replace("{min}", formatChipScore(Math.min(...chips.map((p) => p.score))))
              .replace("{max}", formatChipScore(Math.max(...chips.map((p) => p.score))))}
          </p>
        )
      ) : chips.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {chips.map((p) => (
            <li
              key={p.leaderId}
              className={`rounded-full border px-2.5 py-0.5 text-sm ${
                p.leaderId === userId ? "border-primary bg-primary/10 font-semibold" : "border-border bg-surface-muted"
              }`}
            >
              {nameOf(p.leaderId)}: {formatChipScore(p.score)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A leader's score: whole numbers as they are, subcategory means with a decimal. */
function formatChipScore(score: number): string {
  return Number.isInteger(score) ? String(score) : formatScore(score);
}
