"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { levelBackground, Pitch, pitchSpotStyle } from "@/components/pitch";
import {
  type FormCategory,
  type FormState,
  MAX_COMMENT_LENGTH,
  missingItems,
  requiredItems,
  scoreKey,
  toPayload,
} from "@/lib/assessment/form";
import type { AttendanceValue } from "@/lib/calc";
import { POSITION_COORDS, POSITION_LEVELS, type PositionCode, type PositionLevel } from "@/lib/positions";
import { saveDraft, submitAssessment } from "./actions";

type Copy = Record<
  | "positionsTitle"
  | "positionsHint"
  | "pitchLabel"
  | "positionNone"
  | "remove"
  | "close"
  | "ratingsTitle"
  | "ratingsHint"
  | "attendanceTitle"
  | "attendanceHint"
  | "unknown"
  | "commentTitle"
  | "commentHint"
  | "missing"
  | "missingSummary"
  | "answered"
  | "saving"
  | "saved"
  | "saveFailed"
  | "submittedNote"
  | "unsent"
  | "submit"
  | "resubmit"
  | "submitting",
  string
> & {
  levels: Record<PositionLevel, string>;
  positionLabels: Record<PositionCode, string>;
  attendance: { value: AttendanceValue; label: string }[];
};

type SaveState = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_MS = 800;
const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const itemDomId = (id: string) => `item-${id}`;

const choiceClass =
  "flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface px-2 text-center font-medium " +
  "hover:bg-surface-muted has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-on-primary " +
  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary";

export function AssessmentForm({
  clubId,
  playerId,
  submitted,
  initial,
  categories,
  phases,
  positions,
  copy,
}: {
  clubId: string;
  playerId: string;
  submitted: boolean;
  initial: FormState;
  categories: FormCategory[];
  phases: { id: string; name: string }[];
  positions: PositionCode[];
  copy: Copy;
}) {
  const [state, setState] = useState(initial);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [dirty, setDirty] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitting, startSubmit] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSeq = useRef(0);
  const latest = useRef(state);

  const missing = missingItems(state, categories);
  const missingIds = new Set(missing.map((m) => m.id));
  const requiredCount = requiredItems(categories).length;
  const isMissing = (id: string) => showMissing && missingIds.has(id);

  async function saveNow() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const seq = ++saveSeq.current;
    setSaveState("saving");
    const result = await saveDraft(clubId, playerId, toPayload(latest.current, categories)).catch(() => ({
      ok: false as const,
      message: "",
    }));
    if (seq === saveSeq.current) setSaveState(result.ok ? "saved" : "error");
  }

  function update(change: (s: FormState) => FormState) {
    setSubmitError("");
    setState((s) => {
      const next = change(s);
      latest.current = next;
      return next;
    });
    if (submitted) {
      // A submitted assessment changes only when it is submitted again.
      setDirty(true);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(saveNow, AUTOSAVE_MS);
  }

  // Save right away when the leader leaves the tab, and warn before closing it
  // with unsaved changes.
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

  // Leaving the page (or Next hiding it on navigation) saves a pending draft
  // right away instead of dropping it.
  const flush = useRef(saveNow);
  useEffect(() => {
    flush.current = saveNow;
  });
  useEffect(
    () => () => {
      if (timer.current) void flush.current();
    },
    [],
  );

  function handleSubmit() {
    if (missing.length > 0) {
      setShowMissing(true);
      const element = document.getElementById(itemDomId(missing[0].id));
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      element?.querySelector<HTMLElement>("input, button")?.focus({ preventScroll: true });
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    startSubmit(async () => {
      const result = await submitAssessment(clubId, playerId, toPayload(latest.current, categories));
      if (result && !result.ok) setSubmitError(result.message);
    });
  }

  const statusText = submitted
    ? dirty
      ? copy.unsent
      : ""
    : saveState === "saving"
      ? copy.saving
      : saveState === "saved"
        ? copy.saved
        : saveState === "error"
          ? copy.saveFailed
          : "";

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      noValidate
    >
      {submitted && (
        <p className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">{copy.submittedNote}</p>
      )}

      <Section title={copy.positionsTitle} hint={copy.positionsHint}>
        <MissingFrame id="positions" missing={isMissing("positions")} label={copy.missing}>
          <PositionPicker
            positions={positions}
            value={state.positions}
            onChange={(code, level) =>
              update((s) => {
                const next = { ...s.positions };
                if (level) next[code] = level;
                else delete next[code];
                return { ...s, positions: next };
              })
            }
            copy={copy}
          />
        </MissingFrame>
      </Section>

      <Section title={copy.ratingsTitle} hint={copy.ratingsHint}>
        <div className="flex flex-col gap-6">
          {categories.map((c) => (
            <div key={c.id} className="flex flex-col gap-3">
              <div>
                <h3 className="font-semibold">{c.name}</h3>
                {c.question && <p className="text-sm text-muted">{c.question}</p>}
              </div>
              {(c.subcategories.length > 0 ? c.subcategories : [null]).map((sub) => {
                const key = scoreKey(c.id, sub?.id ?? null);
                return (
                  <MissingFrame key={key} id={key} missing={isMissing(key)} label={copy.missing}>
                    <RatingScale
                      name={`score-${key}`}
                      legend={sub ? sub.name : c.name}
                      legendHidden={!sub}
                      value={state.scores[key]}
                      onChange={(score) => update((s) => ({ ...s, scores: { ...s.scores, [key]: score } }))}
                    />
                  </MissingFrame>
                );
              })}
            </div>
          ))}
        </div>
      </Section>

      {phases.length > 0 && (
        <Section title={copy.attendanceTitle} hint={copy.attendanceHint}>
          <div className="flex flex-col gap-4">
            {phases.map((phase) => (
              <fieldset key={phase.id} className="flex flex-col gap-2">
                <legend className="mb-2 font-medium">{phase.name}</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {[...copy.attendance, { value: null, label: copy.unknown }].map((option) => (
                    <label key={option.value ?? "unknown"} className={choiceClass}>
                      <input
                        type="radio"
                        name={`attendance-${phase.id}`}
                        className="sr-only"
                        checked={(state.attendance[phase.id] ?? null) === option.value}
                        onChange={() =>
                          update((s) => {
                            const attendance = { ...s.attendance };
                            if (option.value === null) delete attendance[phase.id];
                            else attendance[phase.id] = option.value;
                            return { ...s, attendance };
                          })
                        }
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </Section>
      )}

      <Section title={copy.commentTitle} hint={copy.commentHint} labelFor="assessment-comment">
        <textarea
          id="assessment-comment"
          value={state.comment}
          maxLength={MAX_COMMENT_LENGTH}
          rows={4}
          onChange={(e) => update((s) => ({ ...s, comment: e.target.value }))}
          className="w-full rounded-lg border border-border bg-surface p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
      </Section>

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-border bg-surface px-4 py-3">
        {showMissing && missing.length > 0 && (
          <p className="text-sm text-danger">
            {copy.missingSummary.replace("{count}", String(missing.length))}
          </p>
        )}
        {submitError && (
          <p role="alert" className="text-sm text-danger">
            {submitError}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col text-sm">
            <span>
              {copy.answered
                .replace("{done}", String(requiredCount - missing.length))
                .replace("{total}", String(requiredCount))}
            </span>
            <span role="status" className={saveState === "error" ? "text-danger" : "text-muted"}>
              {statusText}
            </span>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="min-h-11 shrink-0 rounded-lg bg-primary px-5 font-semibold text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
          >
            {submitting ? copy.submitting : submitted ? copy.resubmit : copy.submit}
          </button>
        </div>
      </div>
    </form>
  );
}

function Section({
  title,
  hint,
  labelFor,
  children,
}: {
  title: string;
  hint: string;
  labelFor?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        {labelFor ? (
          <label htmlFor={labelFor} className="text-lg font-semibold">
            {title}
          </label>
        ) : (
          <h2 className="text-lg font-semibold">{title}</h2>
        )}
        <p className="text-sm text-muted">{hint}</p>
      </div>
      {children}
    </section>
  );
}

/** Marks an unanswered item after a submit attempt. */
function MissingFrame({
  id,
  missing,
  label,
  children,
}: {
  id: string;
  missing: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      id={itemDomId(id)}
      className={`scroll-mt-24 rounded-lg ${missing ? "bg-danger/5 p-2 outline-2 outline-offset-2 outline-danger" : ""}`}
    >
      {missing && <p className="mb-2 text-sm font-semibold text-danger">{label}</p>}
      {children}
    </div>
  );
}

function RatingScale({
  name,
  legend,
  legendHidden,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  legendHidden: boolean;
  value: number | undefined;
  onChange: (score: number) => void;
}) {
  return (
    <fieldset>
      <legend className={legendHidden ? "sr-only" : "mb-2 text-sm font-medium"}>{legend}</legend>
      {/* Two rows (1–5, 6–10) on narrow screens. */}
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
        {SCORES.map((score) => (
          <label key={score} className={choiceClass}>
            <input
              type="radio"
              name={name}
              value={score}
              className="sr-only"
              checked={value === score}
              onChange={() => onChange(score)}
            />
            <span>{score}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function PositionPicker({
  positions,
  value,
  onChange,
  copy,
}: {
  positions: PositionCode[];
  value: Partial<Record<PositionCode, PositionLevel>>;
  onChange: (code: PositionCode, level: PositionLevel | null) => void;
  copy: Copy;
}) {
  const [open, setOpen] = useState<PositionCode | null>(null);
  const triggers = useRef(new Map<PositionCode, HTMLButtonElement | null>());
  const popover = useRef<HTMLDivElement>(null);

  function close(returnFocus = true) {
    const code = open;
    setOpen(null);
    if (returnFocus && code) triggers.current.get(code)?.focus();
  }

  useEffect(() => {
    if (!open) return;
    popover.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popover.current?.contains(target) || triggers.current.get(open)?.contains(target)) return;
      setOpen(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const selected = positions.filter((code) => value[code]);

  return (
    <div className="flex flex-col gap-3">
      <Pitch label={copy.pitchLabel}>
        {positions.map((code) => {
          const level = value[code];
          return (
            <button
              key={code}
              type="button"
              ref={(el) => {
                triggers.current.set(code, el);
              }}
              aria-label={`${copy.positionLabels[code]}: ${level ? copy.levels[level] : copy.positionNone}`}
              aria-haspopup="dialog"
              aria-expanded={open === code}
              onClick={() => setOpen(open === code ? null : code)}
              style={{ ...pitchSpotStyle(code), background: levelBackground(level) }}
              className={`absolute flex size-11 items-center justify-center rounded-full border-2 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                level ? "border-white text-foreground shadow-md" : "border-white/70 bg-white/15 text-white"
              }`}
            >
              {code}
            </button>
          );
        })}

        {open && (
          <div
            ref={popover}
            role="dialog"
            aria-label={copy.positionLabels[open]}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                close();
              }
            }}
            style={{
              left: `clamp(6.5rem, ${POSITION_COORDS[open].x}%, calc(100% - 6.5rem))`,
              top: `${POSITION_COORDS[open].y}%`,
              transform: POSITION_COORDS[open].y > 55 ? "translate(-50%, calc(-100% - 1.75rem))" : "translate(-50%, 1.75rem)",
            }}
            className="absolute z-10 flex w-52 flex-col gap-1 rounded-xl border border-border bg-surface p-2 text-foreground shadow-lg"
          >
            <div className="flex items-center justify-between gap-2 px-1">
              <p className="text-sm font-semibold">{copy.positionLabels[open]}</p>
            </div>
            {POSITION_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={value[open] === level}
                onClick={() => {
                  onChange(open, level);
                  close();
                }}
                className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-left hover:bg-surface-muted aria-pressed:font-semibold focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span
                  aria-hidden="true"
                  className="size-4 shrink-0 rounded-full border border-border"
                  style={{ background: levelBackground(level) }}
                />
                {copy.levels[level]}
              </button>
            ))}
            {value[open] ? (
              <button
                type="button"
                onClick={() => {
                  onChange(open, null);
                  close();
                }}
                className="min-h-11 rounded-lg px-2 text-left text-danger hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary"
              >
                {copy.remove}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => close()}
                className="min-h-11 rounded-lg px-2 text-left text-muted hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary"
              >
                {copy.close}
              </button>
            )}
          </div>
        )}
      </Pitch>

      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-sm" aria-label={copy.positionsTitle}>
          {selected.map((code) => (
            <li
              key={code}
              className="rounded-full border border-border px-3 py-1"
              style={{ background: levelBackground(value[code]) }}
            >
              {copy.positionLabels[code]}: {copy.levels[value[code]!]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
