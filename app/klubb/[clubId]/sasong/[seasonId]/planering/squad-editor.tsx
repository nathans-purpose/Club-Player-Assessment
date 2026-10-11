"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatScore } from "@/lib/format";
import { POSITION_CODES, type PositionCode } from "@/lib/positions";
import type { RecruitmentTarget, SquadPlanPlayer, SquadPlanPosition } from "@/lib/season/data";
import { PLAYER_PLAN_STATUSES, type PlayerPlanStatus, planPositions, squadTotals } from "@/lib/season/squad";
import type { Player } from "@/lib/assessment/data";
import { saveSquadPlan } from "../../actions";
import { buttonPrimary, input } from "../../ui";
import type { BoardCopy } from "./plan-board";

export type SquadPlayer = Player & { average: number | null; mainPosition: PositionCode | null };

type Wish = { wanted: string; roleNote: string };
type Planned = { status: PlayerPlanStatus | null; position: PositionCode | null; note: string };

export function SquadEditor({
  clubId,
  seasonId,
  players,
  wishes,
  defaultTargets,
  plannedPlayers,
  recruits,
  copy,
}: {
  clubId: string;
  seasonId: string;
  players: SquadPlayer[];
  wishes: SquadPlanPosition[];
  defaultTargets: { code: PositionCode; target: number }[];
  plannedPlayers: SquadPlanPlayer[];
  recruits: RecruitmentTarget[];
  copy: BoardCopy;
}) {
  const router = useRouter();
  const s = copy.squad;
  // Until the leaders have saved a wish list, start from the team's pitch targets.
  const [wish, setWish] = useState<Record<PositionCode, Wish>>(() => {
    const saved = wishes.length > 0;
    return Object.fromEntries(
      POSITION_CODES.map((code) => {
        const w = wishes.find((x) => x.code === code);
        const target = defaultTargets.find((x) => x.code === code)?.target ?? 0;
        return [code, { wanted: String(saved ? (w?.wanted ?? 0) : target), roleNote: w?.roleNote ?? "" }];
      }),
    ) as Record<PositionCode, Wish>;
  });
  const [planned, setPlanned] = useState<Record<string, Planned>>(() =>
    Object.fromEntries(
      players.map((p) => {
        const row = plannedPlayers.find((x) => x.playerId === p.id);
        return [p.id, row ? { status: row.status, position: row.position, note: row.note } : { status: null, position: p.mainPosition, note: "" }];
      }),
    ),
  );
  const [onlyUndecided, setOnlyUndecided] = useState(false);
  const [status, setStatus] = useState("");
  const [pending, start] = useTransition();

  const rows = planPositions(
    POSITION_CODES.map((code) => ({ code, wanted: Number(wish[code].wanted) || 0, roleNote: wish[code].roleNote || null })),
    players
      .filter((p) => planned[p.id]?.status)
      .map((p) => ({ playerId: p.id, status: planned[p.id].status!, position: planned[p.id].position })),
    recruits.map((r) => ({ id: r.id, position: r.position, status: r.status })),
  );
  const totals = squadTotals(rows);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.fullName ?? recruits.find((r) => r.id === id)?.fullName ?? "";
  const shown = onlyUndecided ? players.filter((p) => !planned[p.id]?.status) : players;
  const touched = () => setStatus(copy.common.unsaved);

  function save() {
    start(async () => {
      const result = await saveSquadPlan(clubId, seasonId, {
        positions: POSITION_CODES.map((code) => ({
          code,
          wanted: Number(wish[code].wanted) || 0,
          roleNote: wish[code].roleNote || null,
        })),
        players: players.map((p) => ({
          playerId: p.id,
          status: planned[p.id].status,
          position: planned[p.id].position,
          note: planned[p.id].note || null,
        })),
      }).catch(() => ({ ok: false as const, message: copy.common.error }));
      setStatus(result.ok ? copy.common.saved : result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <p className="font-medium" aria-live="polite">
        {s.totals
          .replace("{wanted}", String(totals.wanted))
          .replace("{secure}", String(totals.secure))
          .replace("{uncertain}", String(totals.uncertain))
          .replace("{missing}", String(totals.missing))}
      </p>

      <div>
        <h4 className="font-semibold">{s.positionsTitle}</h4>
        <p className="text-sm text-muted">{s.positionsHint}</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="bg-surface-muted">
              <tr>
                <th className="p-2">{s.position}</th>
                <th className="p-2">{s.wanted}</th>
                <th className="p-2">{s.role}</th>
                <th className="p-2">{s.secure}</th>
                <th className="p-2">{s.uncertain}</th>
                <th className="p-2">{s.inProgress}</th>
                <th className="p-2">{s.missing}</th>
              </tr>
            </thead>
            <tbody>
              {POSITION_CODES.map((code) => {
                const row = rows.find((r) => r.code === code);
                const label = copy.positions[code];
                return (
                  <tr key={code} className="border-t border-border align-top">
                    <th scope="row" className="p-2 font-medium">
                      {label}
                    </th>
                    <td className="p-2">
                      <input
                        className={`${input} w-16`}
                        inputMode="numeric"
                        aria-label={`${s.wanted}, ${label}`}
                        value={wish[code].wanted}
                        onChange={(e) => {
                          setWish((w) => ({ ...w, [code]: { ...w[code], wanted: e.target.value.replace(/\D/g, "").slice(0, 1) } }));
                          touched();
                        }}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className={`${input} min-w-48`}
                        aria-label={`${s.role}, ${label}`}
                        placeholder={s.rolePlaceholder}
                        maxLength={200}
                        value={wish[code].roleNote}
                        onChange={(e) => {
                          setWish((w) => ({ ...w, [code]: { ...w[code], roleNote: e.target.value } }));
                          touched();
                        }}
                      />
                    </td>
                    <td className="p-2">{names([...(row?.secure ?? []), ...(row?.signed ?? [])], nameOf)}</td>
                    <td className="p-2">{names(row?.uncertain ?? [], nameOf)}</td>
                    <td className="p-2">{names(row?.inProgress ?? [], nameOf)}</td>
                    <td className="p-2">
                      {row && <Gap gap={row.gap} copy={s} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h4 className="font-semibold">{s.playersTitle}</h4>
        <p className="text-sm text-muted">{s.playersHint}</p>
        {players.length === 0 ? (
          <p className="mt-2 text-muted">{s.noPlayers}</p>
        ) : (
          <>
            <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 self-start">
              <input
                type="checkbox"
                className="size-5 accent-[var(--primary)]"
                checked={onlyUndecided}
                onChange={(e) => setOnlyUndecided(e.target.checked)}
              />
              {s.filterUndecided}
            </label>
            <ul className="mt-2 flex flex-col divide-y divide-border" aria-label={s.playersTitle}>
              {shown.map((p) => {
                const plan = planned[p.id];
                const set = (change: Partial<Planned>) => {
                  setPlanned((x) => ({ ...x, [p.id]: { ...x[p.id], ...change } }));
                  touched();
                };
                return (
                  <li key={p.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_10rem_12rem_1fr] sm:items-center">
                    <div>
                      <span className="font-medium">
                        {p.shirtNumber && <span className="mr-2 font-mono text-muted">{p.shirtNumber}</span>}
                        {p.fullName}
                      </span>
                      <span className="block text-sm text-muted">
                        {copy.headings.average}: {formatScore(p.average)}
                        {p.mainPosition &&
                          ` · ${copy.headings.mainPosition.replace("{position}", copy.positions[p.mainPosition])}`}
                      </span>
                    </div>
                    <select
                      className={input}
                      aria-label={`${s.status}, ${p.fullName}`}
                      value={plan.status ?? ""}
                      onChange={(e) => set({ status: (e.target.value || null) as PlayerPlanStatus | null })}
                    >
                      <option value="">{s.noStatus}</option>
                      {PLAYER_PLAN_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {copy.statuses.player[st]}
                        </option>
                      ))}
                    </select>
                    <select
                      className={input}
                      aria-label={`${s.plannedPosition}, ${p.fullName}`}
                      value={plan.position ?? ""}
                      onChange={(e) => set({ position: (e.target.value || null) as PositionCode | null })}
                    >
                      <option value="">{s.noPosition}</option>
                      {POSITION_CODES.map((code) => (
                        <option key={code} value={code}>
                          {copy.positions[code]}
                        </option>
                      ))}
                    </select>
                    <input
                      className={input}
                      aria-label={`${s.note}, ${p.fullName}`}
                      placeholder={s.note}
                      maxLength={200}
                      value={plan.note}
                      onChange={(e) => set({ note: e.target.value })}
                    />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 px-4 py-3">
        <button type="submit" className={buttonPrimary} disabled={pending}>
          {pending ? copy.common.saving : s.saveSquad}
        </button>
        <span className="text-sm text-muted" aria-live="polite">
          {status}
        </span>
      </div>
    </form>
  );
}

function names(ids: string[], nameOf: (id: string) => string) {
  return ids.length ? (
    <span>
      <span className="font-semibold">{ids.length}</span>
      <span className="block text-xs text-muted">{ids.map(nameOf).join(", ")}</span>
    </span>
  ) : (
    <span className="text-muted">0</span>
  );
}

function Gap({ gap, copy }: { gap: number; copy: BoardCopy["squad"] }) {
  if (gap > 0) {
    return <span className="rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 font-semibold">{gap}</span>;
  }
  return <span className="text-muted">{gap < 0 ? copy.surplus.replace("{n}", String(-gap)) : copy.complete}</span>;
}
