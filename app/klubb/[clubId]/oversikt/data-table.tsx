"use client";

import { useId, useState } from "react";
import { type MetricKey, metricValue, type Overview, type SortKey, sortPlayers } from "@/lib/overview";
import { SQUAD_GROUPS, type SquadGroup } from "@/lib/players/squad-groups";
import type { OverviewCopy } from "./copy";
import { formatMetric, heatBackground, metricLabel } from "./metrics";

type Column =
  | { key: "number" | "name"; label: string }
  | { key: "group" | "mainPosition" | "assessments"; label: string }
  | { key: MetricKey; label: string; metric: true };

const SELECT =
  "min-h-11 rounded-lg border border-border bg-surface px-3 focus-visible:outline-2 focus-visible:outline-primary-ink";

/**
 * The Data tab: every player in a sortable table. The sorted column is
 * highlighted, scores get heat colours, and the attendance column follows the
 * phase when sorting by one.
 */
export function DataTable({
  overview,
  copy,
  sort,
  onSort,
  onOpenPlayer,
}: {
  overview: Overview;
  copy: OverviewCopy;
  sort: { key: SortKey; descending: boolean };
  onSort: (sort: { key: SortKey; descending: boolean }) => void;
  onOpenPlayer: (playerId: string) => void;
}) {
  const [group, setGroup] = useState<SquadGroup | "">("");
  const sortId = useId();
  const groupId = useId();

  const label = (key: MetricKey) => metricLabel(key, copy, overview);
  const attendanceKey: MetricKey = sort.key.startsWith("phase:") ? (sort.key as MetricKey) : "attendance";
  const columns: Column[] = [
    { key: "number", label: copy.table.number },
    { key: "name", label: copy.table.name },
    { key: "group", label: copy.table.group },
    { key: "mainPosition", label: copy.table.mainPosition },
    { key: "total", label: copy.metric.totalShort, metric: true },
    ...overview.categories.map((c) => ({ key: `category:${c.id}` as const, label: c.name, metric: true as const })),
    { key: attendanceKey, label: label(attendanceKey), metric: true },
    ...(
      ["matches", "goals", "assists", "yellowCards", "goalsPerMatch", "assistsPerMatch", "yellowCardsPerMatch"] as const
    ).map((key) => ({ key, label: label(key), metric: true as const })),
    { key: "assessments", label: copy.table.assessments },
  ];

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "name", label: copy.table.name },
    { key: "number", label: copy.table.number },
    { key: "total", label: copy.metric.total },
    ...overview.categories.map((c) => ({ key: `category:${c.id}` as const, label: c.name })),
    { key: "attendance", label: copy.metric.attendance },
    ...overview.phases.map((p) => ({ key: `phase:${p.id}` as const, label: label(`phase:${p.id}`) })),
    ...(
      ["matches", "goals", "assists", "yellowCards", "goalsPerMatch", "assistsPerMatch", "yellowCardsPerMatch"] as const
    ).map((key) => ({ key, label: label(key) })),
  ];

  const rows = sortPlayers(
    group ? overview.players.filter((p) => p.squadGroup === group) : overview.players,
    sort.key,
    sort.descending,
  );

  function sortBy(key: SortKey) {
    if (key === sort.key) onSort({ key, descending: !sort.descending });
    else onSort({ key, descending: key !== "name" });
  }

  const sortable = (c: Column): SortKey | null =>
    "metric" in c ? c.key : c.key === "name" || c.key === "number" ? c.key : null;

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={sortId} className="text-sm font-medium">
            {copy.table.sort}
          </label>
          <select
            id={sortId}
            value={sort.key}
            onChange={(e) => {
              const key = e.target.value as SortKey;
              onSort({ key, descending: key !== "name" });
            }}
            className={SELECT}
          >
            {sortOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => onSort({ ...sort, descending: !sort.descending })}
          className="min-h-11 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary-ink"
        >
          {sort.descending ? `↓ ${copy.table.descending}` : `↑ ${copy.table.ascending}`}
        </button>
        <div className="flex flex-col gap-1">
          <label htmlFor={groupId} className="text-sm font-medium">
            {copy.table.group}
          </label>
          <select
            id={groupId}
            value={group}
            onChange={(e) => setGroup(e.target.value as SquadGroup | "")}
            className={SELECT}
          >
            <option value="">{copy.table.allGroups}</option>
            {SQUAD_GROUPS.map((g) => (
              <option key={g} value={g}>
                {copy.groups[g]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-sm text-muted sm:hidden">{copy.table.scrollHint}</p>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{copy.table.caption}</caption>
          <thead>
            <tr className="border-b border-border">
              {columns.map((c) => {
                const key = sortable(c);
                const active = key !== null && key === sort.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort.descending ? "descending" : "ascending") : undefined}
                    className={`whitespace-nowrap px-2 py-1 text-left align-bottom font-medium ${
                      c.key === "name" ? "sticky left-0 z-10 bg-surface" : ""
                    } ${active ? "bg-primary/15 text-primary-ink" : "text-muted"}`}
                  >
                    {key ? (
                      <button
                        type="button"
                        onClick={() => sortBy(key)}
                        className="inline-flex min-h-11 items-center gap-1 font-medium hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary-ink"
                      >
                        {c.label}
                        {active && <span aria-hidden="true">{sort.descending ? "↓" : "↑"}</span>}
                      </button>
                    ) : (
                      <span className="inline-flex min-h-11 items-center">{c.label}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-2 py-4 text-muted">
                  {copy.table.empty}
                </td>
              </tr>
            )}
            {rows.map((p) => (
              // Few assessments: italic and marked, not greyed out, so the numbers stay readable on the heat colours.
              <tr key={p.id} className={`border-b border-border last:border-0 ${p.fewAssessments ? "italic" : ""}`}>
                {columns.map((c) => {
                  const active = sortable(c) === sort.key;
                  const highlight = active ? "outline outline-1 -outline-offset-1 outline-primary/40" : "";
                  if (c.key === "number") {
                    return (
                      <td key={c.key} className={`px-2 py-1 font-mono ${highlight}`}>
                        {p.shirtNumber ?? "–"}
                      </td>
                    );
                  }
                  if (c.key === "name") {
                    return (
                      <th
                        key={c.key}
                        scope="row"
                        className={`sticky left-0 z-10 bg-surface px-2 py-0 text-left ${highlight}`}
                      >
                        <button
                          type="button"
                          onClick={() => onOpenPlayer(p.id)}
                          className="min-h-11 whitespace-nowrap text-left font-semibold underline decoration-border underline-offset-2 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-primary-ink"
                        >
                          {p.fullName}
                        </button>
                      </th>
                    );
                  }
                  if (c.key === "group") {
                    return (
                      <td key={c.key} className="whitespace-nowrap px-2 py-1">
                        {p.squadGroup ? copy.groups[p.squadGroup] : "–"}
                      </td>
                    );
                  }
                  if (c.key === "mainPosition") {
                    return (
                      <td key={c.key} className="whitespace-nowrap px-2 py-1">
                        {p.mainPosition ? copy.positions[p.mainPosition] : "–"}
                      </td>
                    );
                  }
                  if (c.key === "assessments") {
                    return (
                      <td key={c.key} className="whitespace-nowrap px-2 py-1">
                        {p.submittedCount}
                        {p.fewAssessments && <span className="ml-1 text-xs text-muted">({copy.player.few})</span>}
                      </td>
                    );
                  }
                  const value = metricValue(p, c.key);
                  return (
                    <td
                      key={c.key}
                      style={{ background: heatBackground(c.key, value) }}
                      className={`whitespace-nowrap px-2 py-1 text-right tabular-nums ${active ? "font-bold" : ""} ${highlight}`}
                    >
                      {formatMetric(c.key, value, true)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
