"use client";

import { EditableText } from "@/components/text-edit";
import { useEffect, useId, useRef, useState } from "react";
import { Pitch, pitchSpotStyle } from "@/components/pitch";
import { glows, scaleColor } from "@/lib/calc";
import { formatScore } from "@/lib/format";
import { metricValue, type MetricKey, type Overview, type PitchMetric, type PitchSpot } from "@/lib/overview";
import { POSITION_COORDS, type PositionCode, type PositionLevel } from "@/lib/positions";
import type { OverviewCopy } from "./copy";

const HOVER_CLOSE_DELAY = 150;

/**
 * The team pitch with metric chips (rules 7–9). Hovering or focusing a
 * position shows who can play there; a tap or click pins it, with a close
 * button, so it works on touch screens too. The level chips narrow the pitch
 * to natural players, or natural and "funkar bra"; all three is the default.
 */
export function TeamPitch({
  overview,
  copy,
  onOpenPlayer,
}: {
  overview: Overview;
  copy: OverviewCopy;
  onOpenPlayer: (playerId: string, metric: MetricKey | null) => void;
}) {
  const [metric, setMetric] = useState<PitchMetric>("count");
  const [minLevel, setMinLevel] = useState<PositionLevel>(1);
  const [hovered, setHovered] = useState<PositionCode | null>(null);
  const [focused, setFocused] = useState<PositionCode | null>(null);
  const [pinned, setPinned] = useState<PositionCode | null>(null);
  // Closed with Esc or the close button: stays closed while focus or the
  // pointer is still on that position.
  const [dismissed, setDismissed] = useState<PositionCode | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const spotRefs = useRef<Partial<Record<PositionCode, HTMLButtonElement | null>>>({});
  const tooltipId = useId();
  const headingId = useId();

  const transient = hovered ?? focused;
  const shown = pinned ?? (transient === dismissed ? null : transient);
  const pitch = overview.pitchByLevel[minLevel];
  const spot = pitch.find((s) => s.code === shown) ?? null;

  function close(code: PositionCode) {
    clearTimeout(hoverTimer.current);
    setHovered(null);
    setPinned(null);
    setDismissed(code);
    spotRefs.current[code]?.focus();
  }

  // Esc closes the tooltip; a tap outside the pitch closes a pinned one.
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(shown);
    };
    const onPointer = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setPinned(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [shown]);

  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  function hover(code: PositionCode | null) {
    clearTimeout(hoverTimer.current);
    if (code) setHovered(code);
    else hoverTimer.current = setTimeout(() => setHovered(null), HOVER_CLOSE_DELAY);
  }

  const metrics: { id: PitchMetric; label: string }[] = [
    { id: "count", label: copy.pitch.count },
    ...overview.categories.map((c) => ({ id: `category:${c.id}` as const, label: c.name })),
    { id: "total", label: copy.metric.totalShort },
  ];
  const metricName = metrics.find((m) => m.id === metric)!.label;
  const levels: { id: PositionLevel; label: string }[] = [
    { id: 3, label: copy.pitch.levelNatural },
    { id: 2, label: copy.pitch.levelGood },
    { id: 1, label: copy.pitch.levelAll },
  ];
  const hint =
    metric === "count"
      ? minLevel === 3
        ? copy.pitch.countHintNatural
        : copy.pitch.countHint
      : minLevel === 3
        ? copy.pitch.attributeHintNatural
        : minLevel === 2
          ? copy.pitch.attributeHintGood
          : copy.pitch.attributeHint;

  function display(s: PitchSpot): { t: number | null; text: string } {
    if (metric === "count") {
      return {
        t: s.coverage.t,
        text: copy.pitch.coverage
          .replace("{strong}", String(s.coverage.strongCount))
          .replace("{target}", String(s.coverage.target)),
      };
    }
    const a = s.attributes[metric];
    return { t: a?.t ?? null, text: formatScore(a?.average ?? null) };
  }

  const playerMetric: MetricKey | null = metric === "count" ? null : metric;
  const playersById = new Map(overview.players.map((p) => [p.id, p]));

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <EditableText as="h2" id={headingId} className="text-lg font-semibold" {...copy.editable.pitch} />
      <Chips label={copy.pitch.metrics} options={metrics} value={metric} onChange={setMetric} />
      <Chips label={copy.pitch.levelFilter} options={levels} value={minLevel} onChange={setMinLevel} />
      <p className="text-sm text-muted">
        {hint} {copy.pitch.hint}
      </p>

      <div ref={containerRef}>
        <Pitch label={`${copy.pitch.title}: ${metricName}`}>
          {pitch.map((s) => {
            const { t, text } = display(s);
            const open = shown === s.code;
            return (
              <button
                key={s.code}
                ref={(el) => {
                  spotRefs.current[s.code] = el;
                }}
                type="button"
                aria-label={copy.pitch.spot.replace("{position}", copy.positions[s.code]).replace("{value}", text)}
                aria-expanded={open}
                aria-controls={open ? tooltipId : undefined}
                onMouseEnter={() => hover(s.code)}
                onMouseLeave={() => {
                  hover(null);
                  setDismissed(null);
                }}
                onFocus={() => setFocused(s.code)}
                onBlur={() => {
                  setFocused(null);
                  setDismissed(null);
                }}
                onClick={() => {
                  setDismissed(null);
                  setPinned((p) => (p === s.code ? null : s.code));
                }}
                style={pitchSpotStyle(s.code)}
                className={`absolute flex flex-col items-center gap-0.5 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  open ? "z-10" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  style={{
                    background: t === null ? undefined : scaleColor(t),
                    boxShadow:
                      t !== null && glows(t)
                        ? "0 0 12px 4px color-mix(in srgb, var(--scale-high) 70%, transparent)"
                        : undefined,
                  }}
                  className={`flex size-11 items-center justify-center rounded-full border-2 text-xs font-bold ${
                    t === null ? "border-white/60 text-white" : "border-white text-foreground"
                  } ${open ? "ring-2 ring-foreground" : ""}`}
                >
                  {s.code}
                </span>
                <span
                  aria-hidden="true"
                  className="whitespace-nowrap rounded-full bg-surface px-1.5 text-[11px] font-semibold leading-4 text-foreground shadow"
                >
                  {text}
                </span>
              </button>
            );
          })}

          {spot && (
            <div
              id={tooltipId}
              onMouseEnter={() => hover(spot.code)}
              onMouseLeave={() => hover(null)}
              style={tooltipStyle(spot.code)}
              className="absolute z-20 w-56 rounded-lg border border-border bg-surface p-3 text-sm text-foreground shadow-lg"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">
                  {copy.positions[spot.code]}
                  <span className="block text-xs font-normal text-muted">
                    {metricName}: {display(spot).text}
                  </span>
                </p>
                {pinned === spot.code && (
                  <button
                    type="button"
                    onClick={() => close(spot.code)}
                    className="-mr-1 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary-ink"
                  >
                    <span aria-hidden="true">✕</span>
                    <span className="sr-only">{copy.pitch.close}</span>
                  </button>
                )}
              </div>
              {spot.players.length === 0 ? (
                <p className="mt-2 text-muted">{minLevel === 1 ? copy.pitch.noPlayers : copy.pitch.noPlayersAtLevel}</p>
              ) : (
                <ul className="mt-2 flex max-h-56 flex-col overflow-y-auto">
                  {spot.players.map(({ id, level }) => {
                    const player = playersById.get(id)!;
                    const value = playerMetric ? formatScore(metricValue(player, playerMetric)) : null;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => onOpenPlayer(id, playerMetric)}
                          className={`flex min-h-11 w-full items-center gap-2 rounded px-1 text-left hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary-ink ${
                            player.fewAssessments ? "text-muted" : ""
                          }`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{player.fullName}</span>
                            <span className="block text-xs text-muted">{copy.levels[level]}</span>
                          </span>
                          {value && <span className="font-semibold">{value}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </Pitch>
      </div>
      <p className="text-sm text-muted">{copy.pitch.legend}</p>
    </section>
  );
}

/** A row of toggle chips; exactly one is pressed. */
function Chips<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-sm text-muted">{label}</span>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`min-h-11 rounded-full border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink ${
            value === o.id ? "border-primary bg-primary text-on-primary" : "border-border hover:bg-surface-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Keeps the tooltip on the pitch: beside edge positions, under the top half. */
function tooltipStyle(code: PositionCode) {
  const { x, y } = POSITION_COORDS[code];
  const horizontal =
    x < 35
      ? { left: `calc(${x}% - 24px)` }
      : x > 65
        ? { right: `calc(${100 - x}% - 24px)` }
        : { left: `${x}%`, transform: "translateX(-50%)" };
  const vertical = y < 50 ? { top: `calc(${y}% + 44px)` } : { bottom: `calc(${100 - y}% + 30px)` };
  return { ...horizontal, ...vertical };
}
