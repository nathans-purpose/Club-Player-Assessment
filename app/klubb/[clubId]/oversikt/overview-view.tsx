"use client";

import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";
import { formatCount, formatPercent, formatScore } from "@/lib/format";
import { higherIsBetter, type MetricKey, type Overview, type SortKey } from "@/lib/overview";
import type { OverviewCopy } from "./copy";
import { DataTable } from "./data-table";
import { Facts } from "./facts";
import { QuickView, type QuickViewState } from "./quick-view";
import { RadarCard } from "./radar";
import { Rankings } from "./rankings";
import { TeamPitch } from "./team-pitch";

type Tab = "overview" | "data";
const TABS: Tab[] = ["overview", "data"];

export function OverviewView({
  clubId,
  heading,
  overview,
  submittedByMe,
  initialTab,
  copy,
}: {
  clubId: string;
  heading: { kicker: string; title: string };
  overview: Overview;
  submittedByMe: string[];
  initialTab: Tab;
  copy: OverviewCopy;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: "total", descending: true });
  const [quickView, setQuickView] = useState<QuickViewState | null>(null);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ overview: null, data: null });
  const baseId = useId();

  function selectTab(next: Tab, focus = false) {
    setTab(next);
    if (focus) tabRefs.current[next]?.focus();
    // Keep the tab in the address so a reload or a shared link opens it.
    const url = new URL(window.location.href);
    if (next === "data") url.searchParams.set("flik", "data");
    else url.searchParams.delete("flik");
    window.history.replaceState(window.history.state, "", url);
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = TABS.indexOf(tab);
    const next =
      event.key === "ArrowRight"
        ? TABS[(index + 1) % TABS.length]
        : event.key === "ArrowLeft"
          ? TABS[(index - 1 + TABS.length) % TABS.length]
          : event.key === "Home"
            ? TABS[0]
            : event.key === "End"
              ? TABS[TABS.length - 1]
              : null;
    if (!next) return;
    event.preventDefault();
    selectTab(next, true);
  }

  /** "Lag" in the rankings: every player sorted by the metric, best first. */
  function showSorted(metric: MetricKey) {
    setSort({ key: metric, descending: higherIsBetter(metric) });
    selectTab("data");
    window.scrollTo({ top: 0 });
  }

  const openPlayers = (playerIds: string[], metric: MetricKey | null) => setQuickView({ playerIds, metric });
  const { kpis } = overview;

  return (
    <>
      <div>
        <p className="text-sm text-muted">{heading.kicker}</p>
        <h1 className="mt-1 text-2xl font-bold">{heading.title}</h1>
      </div>

      <div role="tablist" aria-label={copy.tabs.label} className="flex gap-1 border-b border-border">
        {TABS.map((id) => (
          <button
            key={id}
            ref={(el) => {
              tabRefs.current[id] = el;
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`${baseId}-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => selectTab(id)}
            onKeyDown={onTabKeyDown}
            className={`-mb-px min-h-11 border-b-2 px-4 font-semibold focus-visible:outline-2 focus-visible:outline-primary ${
              tab === id ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {copy.tabs[id]}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-overview`}
        aria-labelledby={`${baseId}-tab-overview`}
        hidden={tab !== "overview"}
        className="flex flex-col gap-6"
      >
        <section aria-label={copy.kpi.label} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Tile label={copy.kpi.teamAverage}>{formatScore(kpis.teamAverage)}</Tile>
          <Tile label={copy.kpi.players}>{kpis.players}</Tile>
          <Tile label={copy.kpi.submitted} hint={copy.kpi.submittedOf.replace("{total}", String(kpis.expected))}>
            {kpis.submitted}
          </Tile>
          <Tile label={copy.kpi.goals}>{formatCount(kpis.goals)}</Tile>
          <Tile label={copy.kpi.attendance}>{formatPercent(kpis.attendance)}</Tile>
          <Tile label={copy.kpi.disagreements} hint={kpis.disagreements > 0 ? copy.kpi.disagreementsHint : undefined}>
            {kpis.disagreements}
          </Tile>
        </section>

        {overview.waiting ? (
          <section className="rounded-lg border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold">
              {copy.waiting.title.replace("{done}", String(kpis.submitted)).replace("{total}", String(kpis.expected))}
            </h2>
            <p className="mt-2 max-w-prose text-muted">{copy.waiting.body}</p>
            <button
              type="button"
              onClick={() => selectTab("data")}
              className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-semibold hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary"
            >
              {copy.waiting.toData}
            </button>
          </section>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <TeamPitch overview={overview} copy={copy} onOpenPlayer={(id, metric) => openPlayers([id], metric)} />
              <div className="flex flex-col gap-6">
                <RadarCard overview={overview} copy={copy} />
                <Facts overview={overview} copy={copy} />
              </div>
            </div>
            <Rankings overview={overview} copy={copy} onShowSorted={showSorted} onOpenPlayers={openPlayers} />
          </>
        )}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-data`}
        aria-labelledby={`${baseId}-tab-data`}
        hidden={tab !== "data"}
        className="flex flex-col gap-4"
      >
        <DataTable
          overview={overview}
          copy={copy}
          sort={sort}
          onSort={setSort}
          onOpenPlayer={(id) => openPlayers([id], sort.key === "name" || sort.key === "number" ? null : sort.key)}
        />
      </div>

      <QuickView
        clubId={clubId}
        state={quickView}
        overview={overview}
        submittedByMe={submittedByMe}
        copy={copy}
        onClose={() => setQuickView(null)}
      />
    </>
  );
}

function Tile({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <span className="block text-sm text-muted">{label}</span>
      <span className="text-2xl font-bold">{children}</span>
      {hint && <span className="block text-sm text-muted">{hint}</span>}
    </div>
  );
}
