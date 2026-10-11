"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CommonCopy, ResultsCopy } from "@/lib/season/copy";
import { GOAL_SOURCES, type GoalSource, type SeasonReview } from "@/lib/season/summary";
import { saveReview } from "../../actions";
import { buttonPrimary, card, input, label as labelClass } from "../../ui";

type Numbers = Record<"finalPosition" | "manualMatches" | "manualPoints" | "manualGoalsFor" | "manualGoalsAgainst", string>;
type Sources = Record<GoalSource, { scored: string; conceded: string }>;

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
const num = (s: string) => (s.trim() === "" ? null : Number.parseInt(s, 10));
const digits = (s: string, max = 3) => s.replace(/\D/g, "").slice(0, max);

export function ReviewForm({
  clubId,
  seasonId,
  initial,
  copy,
  common,
  sourceLabels,
}: {
  clubId: string;
  seasonId: string;
  initial: SeasonReview;
  copy: ResultsCopy;
  common: CommonCopy;
  sourceLabels: Record<GoalSource, string>;
}) {
  const router = useRouter();
  const [numbers, setNumbers] = useState<Numbers>({
    finalPosition: str(initial.finalPosition),
    manualMatches: str(initial.manualMatches),
    manualPoints: str(initial.manualPoints),
    manualGoalsFor: str(initial.manualGoalsFor),
    manualGoalsAgainst: str(initial.manualGoalsAgainst),
  });
  const [sources, setSources] = useState<Sources>(
    () =>
      Object.fromEntries(
        GOAL_SOURCES.map((s) => [s, { scored: str(initial.goalSources[s]?.scored), conceded: str(initial.goalSources[s]?.conceded) }]),
      ) as Sources,
  );
  const [status, setStatus] = useState<"idle" | "saved" | "dirty" | string>("idle");
  const [pending, start] = useTransition();

  const setNumber = (key: keyof Numbers, value: string) => {
    setNumbers((n) => ({ ...n, [key]: digits(value, key === "finalPosition" || key === "manualMatches" ? 2 : 3) }));
    setStatus("dirty");
  };

  function save() {
    start(async () => {
      const result = await saveReview(clubId, seasonId, {
        finalPosition: num(numbers.finalPosition),
        manualMatches: num(numbers.manualMatches),
        manualPoints: num(numbers.manualPoints),
        manualGoalsFor: num(numbers.manualGoalsFor),
        manualGoalsAgainst: num(numbers.manualGoalsAgainst),
        goalSources: Object.fromEntries(
          GOAL_SOURCES.filter((s) => sources[s].scored || sources[s].conceded).map((s) => [
            s,
            { scored: num(sources[s].scored), conceded: num(sources[s].conceded) },
          ]),
        ),
      }).catch(() => ({ ok: false as const, message: common.error }));
      setStatus(result.ok ? "saved" : result.message);
      if (result.ok) router.refresh();
    });
  }

  const manual: (keyof Numbers)[] = ["manualMatches", "manualPoints", "manualGoalsFor", "manualGoalsAgainst"];

  return (
    <form
      className={`${card} flex flex-col gap-4`}
      aria-labelledby="review"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <h3 id="review" className="text-lg font-semibold">
        {copy.reviewTitle}
      </h3>
      <label className="flex flex-col gap-1">
        <span className={labelClass}>{copy.finalPosition}</span>
        <input
          className={`${input} w-28`}
          inputMode="numeric"
          value={numbers.finalPosition}
          onChange={(e) => setNumber("finalPosition", e.target.value)}
        />
      </label>

      <fieldset>
        <legend className="font-semibold">{copy.goalSourcesTitle}</legend>
        <p className="text-sm text-muted">{copy.goalSourcesHint}</p>
        <div className="mt-2 grid max-w-md grid-cols-[1fr_5rem_5rem] items-center gap-2">
          <span className="text-sm text-muted">{copy.source}</span>
          <span className="text-sm text-muted" aria-hidden="true">
            {copy.scored}
          </span>
          <span className="text-sm text-muted" aria-hidden="true">
            {copy.conceded}
          </span>
          {GOAL_SOURCES.map((s) => (
            <div key={s} className="contents">
              <span>{sourceLabels[s]}</span>
              {(["scored", "conceded"] as const).map((k) => (
                <input
                  key={k}
                  className={input}
                  inputMode="numeric"
                  aria-label={`${sourceLabels[s]}, ${k === "scored" ? copy.scored : copy.conceded}`}
                  value={sources[s][k]}
                  onChange={(e) => {
                    setSources((x) => ({ ...x, [s]: { ...x[s], [k]: digits(e.target.value) } }));
                    setStatus("dirty");
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </fieldset>

      <details>
        <summary className="min-h-11 cursor-pointer font-semibold">{copy.manualTitle}</summary>
        <p className="max-w-prose text-sm text-muted">{copy.manualHint}</p>
        <div className="mt-2 grid max-w-md grid-cols-2 gap-2">
          {manual.map((key) => (
            <label key={key} className="flex flex-col gap-1">
              <span className={labelClass}>{copy[key]}</span>
              <input className={input} inputMode="numeric" value={numbers[key]} onChange={(e) => setNumber(key, e.target.value)} />
            </label>
          ))}
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={buttonPrimary} disabled={pending}>
          {pending ? common.saving : copy.saveReview}
        </button>
        <span className="text-sm text-muted" aria-live="polite">
          {status === "saved" ? common.saved : status === "dirty" ? common.unsaved : status === "idle" ? "" : status}
        </span>
      </div>
    </form>
  );
}
