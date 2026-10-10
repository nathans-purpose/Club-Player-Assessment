"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { type MetricKey, metricValue, type Overview, type OverviewPlayer } from "@/lib/overview";
import type { OverviewCopy } from "./copy";
import { formatMetric, heatBackground, metricLabel } from "./metrics";

export type QuickViewState = { playerIds: string[]; metric: MetricKey | null };

/**
 * A player's numbers in a modal dialog, with the metric the leader came from
 * highlighted. Ties open every tied player. Esc and the close button close it,
 * and focus returns to where it was.
 */
export function QuickView({
  clubId,
  state,
  overview,
  submittedByMe,
  copy,
  onClose,
}: {
  clubId: string;
  state: QuickViewState | null;
  overview: Overview;
  submittedByMe: string[];
  copy: OverviewCopy;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (state && !dialog.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
    } else if (!state && dialog.open) {
      dialog.close();
    }
  }, [state]);

  const players = (state?.playerIds ?? [])
    .map((id) => overview.players.find((p) => p.id === id))
    .filter((p): p is OverviewPlayer => Boolean(p));
  const metric = state?.metric ?? null;
  const title = players.length === 1 ? players[0].fullName : copy.player.tied.replace("{n}", String(players.length));

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => {
        onClose();
        returnFocus.current?.focus();
      }}
      // A click on the backdrop lands on the dialog element itself.
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="m-auto max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg rounded-xl border border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/50"
    >
      {state && (
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 id={titleId} className="text-xl font-bold">
                {title}
              </h2>
              {metric && <p className="text-sm text-muted">{metricLabel(metric, copy, overview)}</p>}
            </div>
            <form method="dialog">
              <button
                type="submit"
                className="flex size-11 items-center justify-center rounded-lg hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span aria-hidden="true">✕</span>
                <span className="sr-only">{copy.player.close}</span>
              </button>
            </form>
          </div>
          {players.map((p) => (
            <PlayerCard
              key={p.id}
              clubId={clubId}
              player={p}
              metric={metric}
              showName={players.length > 1}
              submitted={submittedByMe.includes(p.id)}
              overview={overview}
              copy={copy}
            />
          ))}
        </div>
      )}
    </dialog>
  );
}

function PlayerCard({
  clubId,
  player,
  metric,
  showName,
  submitted,
  overview,
  copy,
}: {
  clubId: string;
  player: OverviewPlayer;
  metric: MetricKey | null;
  showName: boolean;
  submitted: boolean;
  overview: Overview;
  copy: OverviewCopy;
}) {
  const href = `/klubb/${clubId}/spelare/${player.id}${submitted ? "/samlad" : ""}`;
  const groups: { title: string; metrics: MetricKey[] }[] = [
    { title: copy.player.ratings, metrics: ["total", ...overview.categories.map((c) => `category:${c.id}` as const)] },
    { title: copy.player.attendance, metrics: ["attendance", ...overview.phases.map((p) => `phase:${p.id}` as const)] },
    {
      title: copy.player.stats,
      metrics: [
        "matches",
        "goals",
        "assists",
        "yellowCards",
        "goalsPerMatch",
        "assistsPerMatch",
        "yellowCardsPerMatch",
      ],
    },
  ];
  const meta = [
    player.shirtNumber && `#${player.shirtNumber}`,
    player.squadGroup && copy.groups[player.squadGroup],
    player.mainPosition && `${copy.player.mainPosition}: ${copy.positions[player.mainPosition]}`,
  ].filter(Boolean);

  return (
    <article className={`flex flex-col gap-3 ${showName ? "rounded-lg border border-border p-3" : ""}`}>
      <div>
        {showName && <h3 className="text-lg font-semibold">{player.fullName}</h3>}
        <p className="text-sm text-muted">{meta.join(" · ")}</p>
        <p className="mt-1 flex flex-wrap gap-2 text-sm">
          <span>{copy.player.assessments.replace("{n}", String(player.submittedCount))}</span>
          {player.fewAssessments && (
            <span className="rounded-full border border-border bg-surface-muted px-2 text-xs leading-5">
              {copy.player.few}
            </span>
          )}
          {player.disagreement && (
            <span className="rounded-full border border-scale-mid bg-scale-mid/20 px-2 text-xs font-semibold leading-5">
              {copy.player.disagreement}
            </span>
          )}
        </p>
      </div>
      {groups.map((g) => (
        <section key={g.title}>
          <h4 className="text-sm font-semibold">{g.title}</h4>
          <dl className="mt-1 grid grid-cols-[1fr_auto] text-sm">
            {g.metrics.map((m) => {
              const value = metricValue(player, m);
              const active = m === metric;
              return (
                <div
                  key={m}
                  aria-current={active ? "true" : undefined}
                  className={`col-span-2 grid grid-cols-subgrid rounded px-2 py-1 ${
                    active ? "bg-primary/15 font-bold ring-2 ring-primary" : ""
                  }`}
                >
                  <dt>{metricLabel(m, copy, overview)}</dt>
                  <dd className="rounded px-1 text-right tabular-nums" style={{ background: heatBackground(m, value) }}>
                    {formatMetric(m, value)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
      <Link
        href={href}
        className="inline-flex min-h-11 items-center self-start rounded-lg bg-primary px-4 font-semibold text-on-primary hover:opacity-90"
      >
        {submitted ? copy.player.openCombined : copy.player.openCard}
      </Link>
    </article>
  );
}
