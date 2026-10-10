import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  ASSESSMENT_SELECT,
  type AssessmentRow,
  isUuid,
  loadCategories,
  loadPhases,
  loadPositionTargets,
  requireClubMember,
  toPayloadFromRow,
} from "@/lib/assessment/data";
import { fromPayload } from "@/lib/assessment/form";
import { ATTENDANCE_LABELS, ATTENDANCE_VALUES } from "@/lib/calc";
import { APP_NAME } from "@/lib/config";
import { t } from "@/lib/i18n";
import { SQUAD_GROUP_LABELS, type SquadGroup } from "@/lib/players/squad-groups";
import { POSITION_CODES, POSITION_LABELS, POSITION_LEVEL_LABELS, type PositionCode } from "@/lib/positions";
import { AssessmentForm } from "./assessment-form";

export const metadata: Metadata = { title: `Spelarkort – ${APP_NAME}` };

// Spelarkort, step 1: the leader's own assessment of one player.
export default function PlayerCardPage({ params }: PageProps<"/klubb/[clubId]/spelare/[playerId]">) {
  return (
    <Suspense fallback={<p className="text-muted">{t("common.loading", "Laddar …")}</p>}>
      <PlayerCard params={params} />
    </Suspense>
  );
}

async function PlayerCard({ params }: Pick<PageProps<"/klubb/[clubId]/spelare/[playerId]">, "params">) {
  const { clubId, playerId } = await params;
  const { supabase, userId, team, season } = await requireClubMember(clubId);
  if (!team || !season || !isUuid(playerId)) notFound();

  const [{ data: player }, categories, phases, targets, { data: mine }] = await Promise.all([
    supabase
      .from("players")
      .select("id, shirt_number, full_name, squad_group")
      .eq("id", playerId)
      .eq("team_id", team.id)
      .eq("is_active", true)
      .maybeSingle(),
    loadCategories(supabase, team.id),
    loadPhases(supabase, season.id),
    loadPositionTargets(supabase, team.id),
    supabase
      .from("assessments")
      .select(ASSESSMENT_SELECT)
      .eq("season_id", season.id)
      .eq("player_id", playerId)
      .eq("leader_id", userId)
      .maybeSingle<AssessmentRow>(),
  ]);
  if (!player) notFound();

  const initial = mine
    ? fromPayload(toPayloadFromRow(mine))
    : { positions: {}, scores: {}, attendance: {}, comment: "" };
  // The team's positions, plus any the leader chose before they were hidden.
  const shown = new Set<PositionCode>([
    ...(targets.length > 0 ? targets.map((p) => p.code) : POSITION_CODES),
    ...(Object.keys(initial.positions) as PositionCode[]),
  ]);
  const positions = POSITION_CODES.filter((code) => shown.has(code));
  const squadGroup = player.squad_group as SquadGroup | null;
  const listHref = `/klubb/${clubId}/spelare`;

  return (
    <>
      <div>
        <Link href={listHref} className="inline-flex min-h-11 items-center text-sm underline">
          {t("card.back", "← Alla spelare")}
        </Link>
        <h1 className="text-2xl font-bold">
          {player.shirt_number && <span className="mr-2 font-mono text-muted">{player.shirt_number}</span>}
          {player.full_name}
        </h1>
        <p className="mt-1 text-muted">
          {[squadGroup ? t(`squadGroup.${squadGroup}`, SQUAD_GROUP_LABELS[squadGroup]) : null, season.label]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {mine?.status === "submitted" && (
          <Link
            href={`/klubb/${clubId}/spelare/${playerId}/samlad`}
            className="mt-2 inline-flex min-h-11 items-center font-medium underline"
          >
            {t("card.seeCombined", "Se samlad bedömning")}
          </Link>
        )}
      </div>

      <AssessmentForm
        clubId={clubId}
        playerId={playerId}
        submitted={mine?.status === "submitted"}
        initial={initial}
        categories={categories.form}
        phases={phases}
        positions={positions}
        copy={{
          positionsTitle: t("card.positions.title", "Positioner"),
          positionsHint: t(
            "card.positions.hint",
            "Tryck på de positioner spelaren kan spela och välj hur bra det funkar.",
          ),
          pitchLabel: t("card.positions.pitch", "Planen, välj positioner"),
          positionNone: t("card.positions.none", "inte vald"),
          remove: t("card.positions.remove", "Ta bort"),
          close: t("common.close", "Stäng"),
          ratingsTitle: t("card.ratings.title", "Betyg"),
          ratingsHint: t("card.ratings.hint", "1 är svagast och 10 är bäst i laget."),
          attendanceTitle: t("card.attendance.title", "Träningsnärvaro"),
          attendanceHint: t("card.attendance.hint", "Valfritt. Svara ”Vet ej” om du inte vet."),
          unknown: t("card.attendance.unknown", "Vet ej"),
          commentTitle: t("card.comment.title", "Kommentar"),
          commentHint: t("card.comment.hint", "Valfritt. De andra ledarna ser kommentaren när du har skickat in."),
          missing: t("card.missing", "Det här saknas"),
          missingSummary: t("card.missingSummary", "{count} saker saknas. Fyll i det som är markerat."),
          answered: t("card.answered", "{done} av {total} besvarade"),
          saving: t("card.saving", "Sparar …"),
          saved: t("card.saved", "Sparat"),
          saveFailed: t("card.saveFailed", "Kunde inte spara. Försöker igen när du ändrar något."),
          submittedNote: t(
            "card.submittedNote",
            "Du har skickat in den här bedömningen. Ändringar sparas när du skickar in igen.",
          ),
          unsent: t("card.unsent", "Ändringar ej inskickade"),
          submit: t("card.submit", "Skicka in"),
          resubmit: t("card.resubmit", "Skicka in igen"),
          submitting: t("card.submitting", "Skickar …"),
          levels: Object.fromEntries(
            Object.entries(POSITION_LEVEL_LABELS).map(([k, v]) => [k, t(`positionLevel.${k}`, v)]),
          ) as typeof POSITION_LEVEL_LABELS,
          positionLabels: Object.fromEntries(
            Object.entries(POSITION_LABELS).map(([k, v]) => [k, t(`position.${k}`, v)]),
          ) as typeof POSITION_LABELS,
          attendance: ATTENDANCE_VALUES.map((value) => ({
            value,
            label: t(`attendance.${value}`, ATTENDANCE_LABELS[value]),
          })),
        }}
      />
    </>
  );
}
