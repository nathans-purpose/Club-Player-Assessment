import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { isUuid, loadPlayers, loadSubmittedPlayerIds, requireClubMember } from "@/lib/assessment/data";
import { leaderProgress, nextUnassessed } from "@/lib/calc";
import { APP_NAME } from "@/lib/config";
import { EditableText } from "@/components/text-edit";
import { t, te } from "@/lib/i18n";
import { ProgressBar } from "../../progress-bar";

export const metadata: Metadata = { title: `Tack! – ${APP_NAME}` };

// Spelarkort, step 2: after submitting. The main way on is the next player.
export default function ThankYouPage({ params }: PageProps<"/klubb/[clubId]/spelare/[playerId]/tack">) {
  return (
    <Suspense fallback={<p className="text-muted">{t("common.loading", "Laddar …")}</p>}>
      <ThankYou params={params} />
    </Suspense>
  );
}

async function ThankYou({ params }: Pick<PageProps<"/klubb/[clubId]/spelare/[playerId]/tack">, "params">) {
  const { clubId, playerId } = await params;
  const { supabase, userId, team, season } = await requireClubMember(clubId);
  if (!team || !season || !isUuid(playerId)) notFound();

  const [players, submittedIds] = await Promise.all([
    loadPlayers(supabase, team.id),
    loadSubmittedPlayerIds(supabase, season.id, userId),
  ]);
  const player = players.find((p) => p.id === playerId);
  if (!player) notFound();
  if (!submittedIds.includes(playerId)) redirect(`/klubb/${clubId}/spelare/${playerId}`);

  const ids = players.map((p) => p.id);
  const progress = leaderProgress(ids, submittedIds);
  const nextId = nextUnassessed(ids, playerId, submittedIds);
  const next = players.find((p) => p.id === nextId);
  const base = `/klubb/${clubId}/spelare`;

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6 py-6 text-center">
      <div>
        <EditableText as="h1" className="text-2xl font-bold" {...te("thanks.title", "Tack!")} />
        <p className="mt-2 text-muted">
          {t("thanks.body", "Din bedömning av {name} är inskickad.").replace("{name}", player.fullName)}
        </p>
      </div>

      <div className="text-left">
        <ProgressBar
          done={progress.done}
          total={progress.total}
          label={t("players.progress", "{done} av {total} spelare bedömda")
            .replace("{done}", String(progress.done))
            .replace("{total}", String(progress.total))}
        />
      </div>

      {next ? (
        <Link
          href={`${base}/${next.id}`}
          className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary px-5 text-lg font-semibold text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink"
        >
          {t("thanks.next", "Nästa spelare →")}
          <span className="sr-only">: {next.fullName}</span>
        </Link>
      ) : (
        <div className="rounded-lg border border-primary/40 bg-primary/10 p-4">
          <EditableText
            as="p"
            className="font-semibold"
            {...te("thanks.allDone", "Du har bedömt alla spelare. Bra jobbat!")}
          />
          <Link href={base} className="mt-2 inline-flex min-h-11 items-center underline">
            {t("thanks.toList", "Till spelarlistan")}
          </Link>
        </div>
      )}

      {next && (
        <p className="-mt-3 text-sm text-muted">
          {t("thanks.nextName", "Nästa: {name}").replace("{name}", next.fullName)}
        </p>
      )}

      <Link href={`${base}/${playerId}/samlad`} className="inline-flex min-h-11 items-center justify-center underline">
        {t("thanks.combined", "Se samlad bedömning först")}
      </Link>
    </section>
  );
}
