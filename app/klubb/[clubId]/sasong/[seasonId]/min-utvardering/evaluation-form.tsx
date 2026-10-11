"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { CommonCopy, EvaluationCopy } from "@/lib/season/copy";
import type { Area, Evaluation, Training } from "@/lib/season/summary";
import { MAX_STRENGTHS } from "@/lib/season/validate";
import { saveEvaluationDraft, submitEvaluation } from "../../actions";
import { buttonPrimary, card, input, label as labelClass } from "../../ui";

type Rating = { score: number | null; training: Training | null; comment: string };
type State = {
  ratings: Record<string, Rating>;
  strengths: string[];
  weaknesses: string[];
  outlookLevel: number | null;
  outlookPosition: string;
  outlookKeyFactor: string;
};

const AUTOSAVE_MS = 800;
const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const EMPTY_RATING: Rating = { score: null, training: null, comment: "" };

const choiceClass =
  "flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface px-1 text-center text-sm font-medium " +
  "hover:bg-surface-muted has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-on-primary " +
  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-ink";

function initialState(initial: Evaluation | null): State {
  const pad = (list: string[]) => [...list, "", "", ""].slice(0, MAX_STRENGTHS);
  return {
    ratings: Object.fromEntries(
      (initial?.ratings ?? []).map((r) => [r.areaId, { score: r.score, training: r.training, comment: r.comment ?? "" }]),
    ),
    strengths: pad(initial?.strengths ?? []),
    weaknesses: pad(initial?.weaknesses ?? []),
    outlookLevel: initial?.outlookLevel ?? null,
    outlookPosition: initial?.outlookPosition ? String(initial.outlookPosition) : "",
    outlookKeyFactor: initial?.outlookKeyFactor ?? "",
  };
}

function toPayload(state: State, areas: Area[]) {
  const position = Number.parseInt(state.outlookPosition, 10);
  return {
    ratings: areas.map((a) => {
      const r = state.ratings[a.id] ?? EMPTY_RATING;
      return { areaId: a.id, score: r.score, training: r.training, comment: r.comment || null };
    }),
    strengths: state.strengths.map((s) => s.trim()).filter(Boolean),
    weaknesses: state.weaknesses.map((s) => s.trim()).filter(Boolean),
    outlookLevel: state.outlookLevel,
    outlookPosition: Number.isInteger(position) && position >= 1 && position <= 99 ? position : null,
    outlookKeyFactor: state.outlookKeyFactor || null,
  };
}

export function EvaluationForm({
  clubId,
  seasonId,
  areas,
  submitted,
  initial,
  copy,
  common,
}: {
  clubId: string;
  seasonId: string;
  areas: Area[];
  submitted: boolean;
  initial: Evaluation | null;
  copy: EvaluationCopy;
  common: CommonCopy;
}) {
  const [state, setState] = useState(() => initialState(initial));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [submitting, startSubmit] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  const latest = useRef(state);

  async function saveNow() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const n = ++seq.current;
    setSaveState("saving");
    const result = await saveEvaluationDraft(clubId, seasonId, toPayload(latest.current, areas)).catch(() => ({
      ok: false as const,
      message: "",
    }));
    if (n === seq.current) setSaveState(result.ok ? "saved" : "error");
  }

  function update(change: (s: State) => State) {
    setError("");
    setState((s) => {
      const next = change(s);
      latest.current = next;
      return next;
    });
    if (submitted) {
      // A submitted evaluation changes only when it is submitted again.
      setDirty(true);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(saveNow, AUTOSAVE_MS);
  }

  const setRating = (areaId: string, change: Partial<Rating>) =>
    update((s) => ({ ...s, ratings: { ...s.ratings, [areaId]: { ...(s.ratings[areaId] ?? EMPTY_RATING), ...change } } }));

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && timer.current) void saveNow();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (timer.current || (submitted && dirty)) e.preventDefault();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  });

  const groups: string[] = [];
  for (const a of areas) if (!groups.includes(a.groupName)) groups.push(a.groupName);
  const answered = areas.filter((a) => state.ratings[a.id]?.score != null).length;
  const trainingOptions: { value: Training; label: string }[] = [
    { value: "too_little", label: copy.tooLittle },
    { value: "right", label: copy.right },
    { value: "too_much", label: copy.tooMuch },
  ];

  function submit() {
    if (answered === 0) {
      setError(copy.needOne);
      document.getElementById(`area-${areas[0]?.id}`)?.scrollIntoView({ block: "center" });
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    startSubmit(async () => {
      const result = await submitEvaluation(clubId, seasonId, toPayload(latest.current, areas));
      if (result && !result.ok) setError(result.message);
    });
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {groups.map((group) => (
        <fieldset key={group} className={`${card} flex flex-col gap-5`}>
          <legend className="px-1 text-lg font-semibold">{group}</legend>
          {areas
            .filter((a) => a.groupName === group)
            .map((area) => {
              const r = state.ratings[area.id] ?? EMPTY_RATING;
              return (
                <div key={area.id} id={`area-${area.id}`} className="flex flex-col gap-2">
                  <div>
                    <h3 className="font-semibold">{area.name}</h3>
                    {area.question && <p className="text-sm text-muted">{area.question}</p>}
                  </div>
                  <div role="radiogroup" aria-label={`${copy.score}: ${area.name}`} className="grid grid-cols-6 gap-1 sm:grid-cols-11">
                    {SCORES.map((score) => (
                      <label key={score} className={choiceClass}>
                        <input
                          type="radio"
                          className="sr-only"
                          name={`score-${area.id}`}
                          checked={r.score === score}
                          onChange={() => setRating(area.id, { score })}
                        />
                        {score}
                      </label>
                    ))}
                    <label className={`${choiceClass} col-span-2 sm:col-span-1`}>
                      <input
                        type="radio"
                        className="sr-only"
                        name={`score-${area.id}`}
                        checked={r.score === null}
                        onChange={() => setRating(area.id, { score: null })}
                      />
                      {copy.scoreUnknown}
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm" id={`training-${area.id}`}>
                      {copy.training}
                    </span>
                    <div role="radiogroup" aria-labelledby={`training-${area.id}`} className="flex gap-1">
                      {trainingOptions.map((o) => (
                        <label key={o.value} className={`${choiceClass} px-3`}>
                          <input
                            type="radio"
                            className="sr-only"
                            name={`training-${area.id}`}
                            checked={r.training === o.value}
                            onChange={() => setRating(area.id, { training: o.value })}
                            onClick={() => r.training === o.value && setRating(area.id, { training: null })}
                          />
                          {o.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="sr-only">
                      {copy.comment}: {area.name}
                    </span>
                    <input
                      className={input}
                      value={r.comment}
                      maxLength={300}
                      placeholder={copy.commentPlaceholder}
                      onChange={(e) => setRating(area.id, { comment: e.target.value })}
                    />
                  </label>
                </div>
              );
            })}
        </fieldset>
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        {(["strengths", "weaknesses"] as const).map((kind) => (
          <fieldset key={kind} className={`${card} flex flex-col gap-2`}>
            <legend className="px-1 text-lg font-semibold">
              {kind === "strengths" ? copy.strengthsTitle : copy.weaknessesTitle}
            </legend>
            {state[kind].map((value, i) => (
              <label key={i} className="flex flex-col gap-1">
                <span className={labelClass}>
                  {(kind === "strengths" ? copy.strength : copy.weakness).replace("{n}", String(i + 1))}
                </span>
                <input
                  className={input}
                  value={value}
                  maxLength={200}
                  onChange={(e) =>
                    update((s) => ({ ...s, [kind]: s[kind].map((v, k) => (k === i ? e.target.value : v)) }))
                  }
                />
              </label>
            ))}
          </fieldset>
        ))}
      </div>

      <fieldset className={`${card} flex flex-col gap-4`}>
        <legend className="px-1 text-lg font-semibold">{copy.outlookTitle}</legend>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{copy.outlookLevel}</span>
          <select
            className={`${input} w-40`}
            value={state.outlookLevel ?? ""}
            onChange={(e) => update((s) => ({ ...s, outlookLevel: e.target.value ? Number(e.target.value) : null }))}
          >
            <option value="">{copy.notSet}</option>
            {SCORES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{copy.outlookPosition}</span>
          <input
            className={`${input} w-28`}
            inputMode="numeric"
            value={state.outlookPosition}
            maxLength={2}
            onChange={(e) => update((s) => ({ ...s, outlookPosition: e.target.value.replace(/\D/g, "") }))}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{copy.outlookKeyFactor}</span>
          <textarea
            className={`${input} min-h-24 py-2`}
            value={state.outlookKeyFactor}
            maxLength={500}
            onChange={(e) => update((s) => ({ ...s, outlookKeyFactor: e.target.value }))}
          />
        </label>
      </fieldset>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 px-4 py-3">
        <button type="submit" className={buttonPrimary} disabled={submitting}>
          {submitting ? copy.submitting : submitted ? copy.resubmit : copy.submit}
        </button>
        <span className="text-sm text-muted" aria-live="polite">
          {copy.answered.replace("{done}", String(answered)).replace("{total}", String(areas.length))}
          {" · "}
          {submitted
            ? dirty
              ? copy.unsent
              : copy.submittedNote
            : saveState === "saving"
              ? common.saving
              : saveState === "saved"
                ? common.saved
                : saveState === "error"
                  ? common.error
                  : ""}
        </span>
        {error && (
          <p role="alert" className="w-full text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
