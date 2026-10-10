"use client";

import { EditableText } from "@/components/text-edit";
import type { Extreme } from "@/lib/calc";
import type { MetricKey, Overview } from "@/lib/overview";
import type { OverviewCopy } from "./copy";
import { formatMetric, metricKind, metricLabel } from "./metrics";

const CHIP =
  "flex min-h-14 min-w-0 flex-col items-start justify-center rounded-lg border px-2 py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink";

/**
 * "Lag, bäst och svagast" (rule 11). Lag opens the Data tab sorted by the
 * metric; Bäst and Svagast open the players, every tied one included.
 */
export function Rankings({
  overview,
  copy,
  onShowSorted,
  onOpenPlayers,
}: {
  overview: Overview;
  copy: OverviewCopy;
  onShowSorted: (metric: MetricKey) => void;
  onOpenPlayers: (playerIds: string[], metric: MetricKey) => void;
}) {
  const playersById = new Map(overview.players.map((p) => [p.id, p]));

  function who(extreme: Extreme) {
    return extreme.playerIds.length === 1
      ? playersById.get(extreme.playerIds[0])!.fullName
      : copy.rankings.players.replace("{n}", String(extreme.playerIds.length));
  }

  function extremeChip(kind: "best" | "worst", metric: MetricKey, extreme: Extreme | null) {
    const label = copy.rankings[kind];
    if (!extreme) {
      return (
        <div className={`${CHIP} border-border text-muted`}>
          <span className="text-xs">{label}</span>
          <span>–</span>
        </div>
      );
    }
    const value = formatMetric(metric, extreme.value);
    const name = who(extreme);
    // Rule 12: ratings resting on few assessments are muted.
    const muted =
      metricKind(metric) === "score" && extreme.playerIds.every((id) => playersById.get(id)!.fewAssessments);
    return (
      <button
        type="button"
        onClick={() => onOpenPlayers(extreme.playerIds, metric)}
        aria-label={copy.rankings.extremeLabel
          .replace("{kind}", label)
          .replace("{metric}", metricLabel(metric, copy, overview))
          .replace("{value}", value)
          .replace("{who}", name + (muted ? ` (${copy.player.few})` : ""))}
        className={`${CHIP} hover:bg-surface-muted ${muted ? "border-dashed border-muted bg-surface-muted" : "border-border"}`}
      >
        <span className="text-xs text-muted">{label}</span>
        <span className="font-semibold">{value}</span>
        <span className="w-full truncate text-xs">{name}</span>
      </button>
    );
  }

  return (
    <section aria-labelledby="rankings-heading" className="flex flex-col gap-3">
      <div>
        <EditableText as="h2" id="rankings-heading" className="text-lg font-semibold" {...copy.editable.rankings} />
        <EditableText as="p" className="text-sm text-muted" {...copy.editable.rankingsHint} />
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {overview.rankings.map((r) => {
          const label = metricLabel(r.metric, copy, overview);
          const team = formatMetric(r.metric, r.team);
          return (
            <li key={r.metric} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
              <h3 className="font-semibold">{label}</h3>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => onShowSorted(r.metric)}
                  aria-label={copy.rankings.teamLabel.replace("{metric}", label).replace("{value}", team)}
                  className={`${CHIP} border-primary/40 bg-primary/10 hover:bg-primary/20`}
                >
                  <span className="text-xs text-muted">{copy.rankings.team}</span>
                  <span className="font-semibold">{team}</span>
                </button>
                {extremeChip("best", r.metric, r.best)}
                {extremeChip("worst", r.metric, r.worst)}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted">{copy.rankings.rateNote}</p>
    </section>
  );
}
