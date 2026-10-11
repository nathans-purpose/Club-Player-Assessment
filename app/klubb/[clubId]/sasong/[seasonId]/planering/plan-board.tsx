"use client";

import { useState } from "react";
import { formatScore } from "@/lib/format";
import type { CommonCopy, PrioritiesCopy, RecruitsCopy, SquadCopy, StatusLabels } from "@/lib/season/copy";
import type { Priority, RecruitmentTarget, SquadPlanPlayer, SquadPlanPosition } from "@/lib/season/data";
import { POSITION_CODES, type PositionCode } from "@/lib/positions";
import { RECRUITMENT_STATUSES } from "@/lib/season/squad";
import { deletePriority, deleteRecruit, savePriority, saveRecruit } from "../../actions";
import { RowList } from "../../row-list";
import { buttonSecondary, card, input, label as labelClass } from "../../ui";
import { SquadEditor, type SquadPlayer } from "./squad-editor";

type PriorityRow = Omit<Priority, "id"> & { id: string | null };
type RecruitRow = Omit<RecruitmentTarget, "id"> & { id: string | null };

export type BoardCopy = {
  headings: Record<
    "priorities" | "prioritiesHint" | "squad" | "recruits" | "recruitsHint" | "average" | "mainPosition",
    string
  >;
  priorities: PrioritiesCopy;
  squad: SquadCopy;
  recruits: RecruitsCopy;
  statuses: StatusLabels;
  positions: Record<PositionCode, string>;
  common: CommonCopy;
};

const MAX_PRIORITIES = 3;

export function PlanBoard({
  clubId,
  seasonId,
  previousLabel,
  suggestions,
  priorities,
  players,
  wishes,
  defaultTargets,
  plannedPlayers,
  recruits,
  copy,
}: {
  clubId: string;
  seasonId: string;
  previousLabel: string;
  suggestions: { area: string; prioritise: boolean; average: number | null }[];
  priorities: Priority[];
  players: SquadPlayer[];
  wishes: SquadPlanPosition[];
  defaultTargets: { code: PositionCode; target: number }[];
  plannedPlayers: SquadPlanPlayer[];
  recruits: RecruitmentTarget[];
  copy: BoardCopy;
}) {
  const [picked, setPicked] = useState<{ values: PriorityRow[]; version: number }>({ values: [], version: 0 });
  const [used, setUsed] = useState<string[]>([]);
  const p = copy.priorities;
  const r = copy.recruits;
  const open = suggestions.filter(
    (s) => !used.includes(s.area) && !priorities.some((x) => x.area.toLowerCase() === s.area.toLowerCase()),
  );

  return (
    <>
      <section className={`${card} flex flex-col gap-3`} aria-labelledby="priorities">
        <div>
          <h3 id="priorities" className="text-lg font-semibold">
            {copy.headings.priorities}
          </h3>
          <p className="text-sm text-muted">{copy.headings.prioritiesHint}</p>
        </div>
        {open.length > 0 && (
          <div className="rounded-lg bg-surface-muted p-3">
            <h4 className="font-medium">{p.suggestionsTitle.replace("{season}", previousLabel)}</h4>
            <p className="text-sm text-muted">{p.suggestionsHint}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {open.map((s) => (
                <button
                  key={s.area}
                  type="button"
                  className={buttonSecondary}
                  onClick={() => {
                    setUsed((u) => [...u, s.area]);
                    setPicked((x) => ({
                      version: x.version + 1,
                      values: [{ id: null, area: s.area, goal: "", action: "", owner: "", followUp: "" }],
                    }));
                  }}
                >
                  {p.useSuggestion.replace("{area}", s.area)} · {formatScore(s.average)}
                  {s.prioritise && ` · ${p.prioritiseFlag}`}
                </button>
              ))}
            </div>
          </div>
        )}
        <RowList<PriorityRow>
          initial={priorities}
          prepend={picked}
          blank={() => ({ id: null, area: "", goal: "", action: "", owner: "", followUp: "" })}
          save={(v) => savePriority(clubId, seasonId, v)}
          remove={(id) => deletePriority(clubId, seasonId, id)}
          nameOf={(v) => v.area || p.priority.replace("{n}", "")}
          label={copy.headings.priorities}
          itemLabel={(v, i) => v.area || p.priority.replace("{n}", String(i + 1))}
          addLabel={p.add}
          emptyLabel={p.empty}
          common={copy.common}
          render={(v, set) => (
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label={p.area}>
                <input className={input} maxLength={100} value={v.area} onChange={(e) => set({ area: e.target.value })} />
              </Field>
              <Field label={p.goal}>
                <input className={input} maxLength={300} value={v.goal} onChange={(e) => set({ goal: e.target.value })} />
              </Field>
              <Field label={p.action}>
                <input className={input} maxLength={300} value={v.action} onChange={(e) => set({ action: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label={p.owner}>
                  <input className={input} maxLength={100} value={v.owner} onChange={(e) => set({ owner: e.target.value })} />
                </Field>
                <Field label={p.followUp}>
                  <input className={input} maxLength={100} value={v.followUp} onChange={(e) => set({ followUp: e.target.value })} />
                </Field>
              </div>
            </div>
          )}
          footer={(rows) =>
            rows.length > MAX_PRIORITIES ? (
              <p role="status" className="text-sm">
                {p.tooMany}
              </p>
            ) : null
          }
        />
      </section>

      <section className={`${card} flex flex-col gap-3`} aria-labelledby="squad">
        <h3 id="squad" className="text-lg font-semibold">
          {copy.headings.squad}
        </h3>
        <SquadEditor
          clubId={clubId}
          seasonId={seasonId}
          players={players}
          wishes={wishes}
          defaultTargets={defaultTargets}
          plannedPlayers={plannedPlayers}
          recruits={recruits}
          copy={copy}
        />
      </section>

      <section className={`${card} flex flex-col gap-3`} aria-labelledby="recruits">
        <div>
          <h3 id="recruits" className="text-lg font-semibold">
            {copy.headings.recruits}
          </h3>
          <p className="text-sm text-muted">{copy.headings.recruitsHint}</p>
          <p className="mt-1 text-sm text-muted">{r.privacy}</p>
        </div>
        <RowList<RecruitRow>
          initial={recruits}
          blank={() => ({
            id: null,
            fullName: "",
            currentClub: "",
            position: null,
            priority: 2,
            status: "idea",
            note: "",
          })}
          save={(v) => saveRecruit(clubId, seasonId, v)}
          remove={(id) => deleteRecruit(clubId, seasonId, id)}
          nameOf={(v) => v.fullName || r.newRecruit}
          label={copy.headings.recruits}
          itemLabel={(v) => v.fullName || r.newRecruit}
          addLabel={r.add}
          emptyLabel={r.empty}
          common={copy.common}
          render={(v, set) => (
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_11rem]">
              <Field label={r.name}>
                <input className={input} maxLength={100} value={v.fullName} onChange={(e) => set({ fullName: e.target.value })} />
              </Field>
              <Field label={r.club}>
                <input
                  className={input}
                  maxLength={100}
                  value={v.currentClub}
                  onChange={(e) => set({ currentClub: e.target.value })}
                />
              </Field>
              <Field label={r.position}>
                <select
                  className={input}
                  value={v.position ?? ""}
                  onChange={(e) => set({ position: (e.target.value || null) as PositionCode | null })}
                >
                  <option value="">{r.noPosition}</option>
                  {POSITION_CODES.map((code) => (
                    <option key={code} value={code}>
                      {copy.positions[code]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={r.priority}>
                <select
                  className={input}
                  value={v.priority}
                  onChange={(e) => set({ priority: Number(e.target.value) as 1 | 2 | 3 })}
                >
                  {([1, 2, 3] as const).map((n) => (
                    <option key={n} value={n}>
                      {copy.statuses.priority[n]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={r.status}>
                <select
                  className={input}
                  value={v.status}
                  onChange={(e) => set({ status: e.target.value as RecruitRow["status"] })}
                >
                  {RECRUITMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {copy.statuses.recruit[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={r.note}>
                <input className={input} maxLength={500} value={v.note} onChange={(e) => set({ note: e.target.value })} />
              </Field>
            </div>
          )}
        />
      </section>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}
