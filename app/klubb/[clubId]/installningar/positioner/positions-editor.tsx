"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { Pitch, pitchSpotStyle } from "@/components/pitch";
import { POSITION_CODES, type PositionCode } from "@/lib/positions";
import {
  FORMATION_PRESETS,
  type FormationPreset,
  matchingPreset,
  MAX_TARGET,
  setTarget,
  targetTotal,
  type Targets,
  togglePosition,
} from "@/lib/settings/positions";
import { saveTargets } from "./actions";
import type { PositionsCopy } from "./page";

const UNDO_MS = 5000;

const smallButton =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border text-lg font-semibold hover:bg-surface-muted disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary";

const key = (targets: Targets) => JSON.stringify(POSITION_CODES.map((code) => targets[code] ?? null));

export function PositionsEditor({
  clubId,
  gameFormat,
  initial,
  copy,
}: {
  clubId: string;
  gameFormat: number;
  initial: Targets;
  copy: PositionsCopy;
}) {
  const [targets, setTargets] = useState<Targets>(initial);
  const [saved, setSaved] = useState(() => key(initial));
  const [undo, setUndo] = useState<{ previous: Targets; preset: FormationPreset } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const baseId = useId();

  const dirty = key(targets) !== saved;
  const total = targetTotal(targets);
  const active = matchingPreset(targets);
  const shown = POSITION_CODES.filter((code) => targets[code] !== undefined);

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change(next: Targets) {
    setJustSaved(false);
    setTargets(next);
  }

  // A preset overwrites everything, so it can be undone for a few seconds.
  function applyPreset(preset: FormationPreset) {
    setUndo({ previous: targets, preset });
    change({ ...preset.targets });
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveTargets(clubId, targets);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setTargets(result.targets);
      setSaved(key(result.targets));
      setUndo(null);
      setJustSaved(true);
    });
  }

  const name = (code: PositionCode) => copy.positions[code];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <Pitch label={copy.pitch}>
          {POSITION_CODES.map((code) => {
            const target = targets[code];
            const on = target !== undefined;
            return (
              <button
                key={code}
                type="button"
                aria-pressed={on}
                aria-label={
                  on
                    ? copy.spotShown.replace("{position}", name(code)).replace("{n}", String(target))
                    : copy.spotHidden.replace("{position}", name(code))
                }
                onClick={() => change(togglePosition(targets, code))}
                style={pitchSpotStyle(code)}
                className={`absolute flex size-12 flex-col items-center justify-center rounded-full border-2 text-xs font-bold leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  on
                    ? "border-white bg-surface text-foreground shadow-md"
                    : "border-dashed border-white/70 bg-black/10 text-white/90"
                }`}
              >
                {code}
                {on && <span className="mt-0.5 text-[10px] font-semibold">×{target}</span>}
              </button>
            );
          })}
        </Pitch>
        <p className="text-center text-sm">
          <span className="font-semibold">{copy.total.replace("{n}", String(total))}</span>{" "}
          <span className="text-muted">{copy.format.replaceAll("{n}", String(gameFormat))}</span>
        </p>
        {total !== gameFormat && shown.length > 0 && (
          <p role="note" className="rounded-lg border border-scale-mid bg-scale-mid/15 p-3 text-sm">
            {copy.mismatch.replace("{total}", String(total)).replaceAll("{n}", String(gameFormat))}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <section aria-labelledby={`${baseId}-presets`} className="flex flex-col gap-2">
          <h2 id={`${baseId}-presets`} className="text-lg font-semibold">
            {copy.presets}
          </h2>
          <p className="text-sm text-muted">{copy.presetsHint}</p>
          <ul className="flex flex-wrap gap-2">
            {FORMATION_PRESETS.map((preset) => (
              <li key={preset.id}>
                <button
                  type="button"
                  aria-pressed={active?.id === preset.id}
                  onClick={() => applyPreset(preset)}
                  className={`flex min-h-11 flex-col items-start justify-center rounded-lg border px-3 py-1 text-left focus-visible:outline-2 focus-visible:outline-primary ${
                    active?.id === preset.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface hover:bg-surface-muted"
                  }`}
                >
                  <span className="font-semibold">{preset.name}</span>
                  <span className="text-xs text-muted">
                    {copy.presetPlayers.replace("{n}", String(targetTotal(preset.targets)))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {undo && (
            <div
              role="status"
              className="flex flex-wrap items-center gap-3 self-start rounded-lg bg-foreground px-4 py-2 text-sm text-background"
            >
              {copy.presetApplied.replace("{name}", undo.preset.name)}
              <button
                type="button"
                onClick={() => {
                  change(undo.previous);
                  setUndo(null);
                }}
                className="min-h-11 px-2 font-semibold underline"
              >
                {copy.undo}
              </button>
            </div>
          )}
        </section>

        <section aria-labelledby={`${baseId}-targets`} className="flex flex-col gap-2">
          <h2 id={`${baseId}-targets`} className="text-lg font-semibold">
            {copy.targetsTitle}
          </h2>
          {shown.length === 0 ? (
            <p className="text-sm text-muted">{copy.targetsEmpty}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
              {shown.map((code) => {
                const target = targets[code]!;
                const inputId = `${baseId}-${code}`;
                return (
                  <li key={code} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <label htmlFor={inputId} className="min-w-0 flex-1 basis-32">
                      <span className="mr-2 font-mono text-sm text-muted">{code}</span>
                      {name(code)}
                    </label>
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => change(setTarget(targets, code, target - 1))}
                        disabled={target <= 0}
                        aria-label={copy.decrease.replace("{position}", name(code))}
                        className={smallButton}
                      >
                        −
                      </button>
                      <input
                        id={inputId}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={MAX_TARGET}
                        value={target}
                        aria-label={copy.count.replace("{position}", name(code))}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (e.target.value !== "" && Number.isFinite(n)) change(setTarget(targets, code, n));
                        }}
                        className="min-h-11 w-14 rounded-lg border border-border bg-surface text-center focus-visible:outline-2 focus-visible:outline-primary"
                      />
                      <button
                        type="button"
                        onClick={() => change(setTarget(targets, code, target + 1))}
                        disabled={target >= MAX_TARGET}
                        aria-label={copy.increase.replace("{position}", name(code))}
                        className={smallButton}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => change(togglePosition(targets, code))}
                        aria-label={copy.hideLabel.replace("{position}", name(code))}
                        className="ml-1 min-h-11 px-2 text-sm underline"
                      >
                        {copy.hide}
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 px-4 py-3">
          <button
            type="button"
            onClick={save}
            disabled={pending || !dirty || shown.length === 0}
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-on-primary hover:opacity-90 disabled:opacity-60"
          >
            {pending ? copy.saving : copy.save}
          </button>
          <p role="status" className="text-sm">
            {dirty ? copy.unsaved : justSaved ? copy.saved : ""}
          </p>
        </div>
        {error && (
          <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
