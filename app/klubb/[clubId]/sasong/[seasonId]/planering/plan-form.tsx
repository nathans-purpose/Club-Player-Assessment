"use client";

import { useState, useTransition } from "react";
import type { Plan } from "@/lib/season/data";
import type { CommonCopy, PlanCopy } from "@/lib/season/copy";
import { savePlan } from "../../actions";
import { buttonPrimary, input, label as labelClass } from "../../ui";

export function PlanForm({
  clubId,
  seasonId,
  initial,
  copy,
  common,
}: {
  clubId: string;
  seasonId: string;
  initial: Plan;
  copy: PlanCopy;
  common: CommonCopy;
}) {
  const [plan, setPlan] = useState(initial);
  const [status, setStatus] = useState("");
  const [pending, start] = useTransition();
  const set = (key: keyof Plan, value: string) => {
    setPlan((p) => ({ ...p, [key]: value }));
    setStatus(common.unsaved);
  };

  const fields: { key: keyof Plan; label: string; hint?: string; rows?: number; max: number }[] = [
    { key: "goal", label: copy.goal, hint: copy.goalHint, rows: 2, max: 1000 },
    { key: "strategy", label: copy.strategy, hint: copy.strategyHint, rows: 6, max: 3000 },
    { key: "formation", label: copy.formation, max: 100 },
    { key: "keepDoing", label: copy.keepDoing, hint: copy.keepDoingHint, rows: 3, max: 2000 },
  ];

  return (
    <form
      className="mt-3 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await savePlan(clubId, seasonId, plan).catch(() => ({ ok: false as const, message: common.error }));
          setStatus(result.ok ? common.saved : result.message);
        });
      }}
    >
      {fields.map((f) => (
        <label key={f.key} className="flex flex-col gap-1">
          <span className={labelClass}>{f.label}</span>
          {f.hint && <span className="text-sm text-muted">{f.hint}</span>}
          {f.rows ? (
            <textarea
              className={`${input} py-2`}
              rows={f.rows}
              maxLength={f.max}
              value={plan[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
            />
          ) : (
            <input className={`${input} sm:w-64`} maxLength={f.max} value={plan[f.key]} onChange={(e) => set(f.key, e.target.value)} />
          )}
        </label>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={buttonPrimary} disabled={pending}>
          {pending ? common.saving : copy.savePlan}
        </button>
        <span className="text-sm text-muted" aria-live="polite">
          {status}
        </span>
      </div>
    </form>
  );
}
