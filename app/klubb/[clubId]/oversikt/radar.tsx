"use client";

import { EditableText } from "@/components/text-edit";
import { useId, useState } from "react";
import { RADAR_MAX, RADAR_MIN, radarRadius } from "@/lib/calc";
import { formatScore } from "@/lib/format";
import type { Overview } from "@/lib/overview";
import { SQUAD_GROUPS, type SquadGroup } from "@/lib/players/squad-groups";
import type { OverviewCopy } from "./copy";

const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 58;
/** Where the HTML labels sit, in the same units as the SVG. */
const LABEL_RADIUS = 80;
const RINGS = Array.from({ length: RADAR_MAX - RADAR_MIN }, (_, i) => RADAR_MIN + i + 1);

function point(index: number, count: number, r: number): [number, number] {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

function polygon(values: (number | null)[]): string {
  return values.map((v, i) => point(i, values.length, v === null ? 0 : radarRadius(v) * RADIUS).join(",")).join(" ");
}

/**
 * Rule 10: the category averages of the whole team against one squad group,
 * from 4 at the centre to 9 at the edge. The numbers are in the table below.
 */
export function RadarCard({ overview, copy }: { overview: Overview; copy: OverviewCopy }) {
  const groupsWithData = SQUAD_GROUPS.filter((g) => Object.values(overview.radar.groups[g]).some((v) => v !== null));
  const [group, setGroup] = useState<SquadGroup>(groupsWithData.includes("MF") ? "MF" : (groupsWithData[0] ?? "MF"));
  const headingId = useId();
  const selectId = useId();
  const { categories } = overview;
  const team = categories.map((c) => overview.radar.team[c.id]);
  const selected = categories.map((c) => overview.radar.groups[group][c.id]);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <EditableText as="h2" id={headingId} className="text-lg font-semibold" {...copy.editable.radar} />
        <div className="flex flex-col gap-1">
          <label htmlFor={selectId} className="text-sm font-medium">
            {copy.radar.compare}
          </label>
          <select
            id={selectId}
            value={group}
            onChange={(e) => setGroup(e.target.value as SquadGroup)}
            className="min-h-11 rounded-lg border border-border bg-surface px-3 focus-visible:outline-2 focus-visible:outline-primary-ink"
          >
            {SQUAD_GROUPS.map((g) => (
              <option key={g} value={g}>
                {copy.groups[g]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {categories.length < 3 ? (
        <p className="text-sm text-muted">{copy.radar.tooFew}</p>
      ) : (
        <>
          <div className="relative mx-auto aspect-square w-full max-w-sm">
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
              <g fill="none" stroke="var(--border)" strokeWidth="0.6">
                {RINGS.map((v) => (
                  <polygon key={v} points={polygon(categories.map(() => v))} />
                ))}
                {categories.map((c, i) => {
                  const [x, y] = point(i, categories.length, RADIUS);
                  return <line key={c.id} x1={CENTER} y1={CENTER} x2={x} y2={y} />;
                })}
              </g>
              <polygon
                points={polygon(team)}
                fill="none"
                stroke="var(--foreground)"
                strokeWidth="1.2"
                strokeDasharray="3 2"
              />
              <polygon
                points={polygon(selected)}
                fill="color-mix(in srgb, var(--scale-high) 40%, transparent)"
                stroke="var(--primary)"
                strokeWidth="1.5"
              />
            </svg>
            {categories.map((c, i) => {
              const [x, y] = point(i, categories.length, LABEL_RADIUS);
              return (
                <span
                  key={c.id}
                  aria-hidden="true"
                  style={{ left: `${(x / SIZE) * 100}%`, top: `${(y / SIZE) * 100}%` }}
                  className="absolute w-[24%] -translate-x-1/2 -translate-y-1/2 text-center text-[11px] font-semibold leading-tight break-words sm:text-xs"
                >
                  {c.name}
                </span>
              );
            })}
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-hidden="true">
            <li className="flex items-center gap-2">
              <span className="inline-block w-5 border-t-2 border-dashed border-foreground" />
              {copy.radar.team}
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block size-3 rounded-sm border-2 border-primary bg-scale-high/40" />
              {copy.groups[group]}
            </li>
          </ul>

          <table className="w-full text-sm">
            <caption className="sr-only">{copy.radar.caption}</caption>
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th scope="col" className="py-1 font-medium">
                  {copy.radar.category}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {copy.radar.team}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {copy.groups[group]}
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c, i) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <th scope="row" className="py-1 text-left font-normal">
                    {c.name}
                  </th>
                  <td className="py-1 text-right">{formatScore(team[i])}</td>
                  <td className="py-1 text-right font-semibold">{formatScore(selected[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
