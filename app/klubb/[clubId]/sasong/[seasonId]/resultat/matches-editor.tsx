"use client";

import type { CommonCopy, ResultsCopy } from "@/lib/season/copy";
import { type Match, matchRecord, outcome } from "@/lib/season/summary";
import { deleteMatch, saveMatch } from "../../actions";
import { RowList } from "../../row-list";
import { input, label as labelClass } from "../../ui";

type MatchRow = Omit<Match, "id" | "round" | "goalsFor" | "goalsAgainst"> & {
  id: string | null;
  round: string;
  goalsFor: string;
  goalsAgainst: string;
};

const toRow = (m: Match): MatchRow => ({
  ...m,
  round: m.round === null ? "" : String(m.round),
  goalsFor: m.goalsFor === null ? "" : String(m.goalsFor),
  goalsAgainst: m.goalsAgainst === null ? "" : String(m.goalsAgainst),
});

const num = (s: string) => (s.trim() === "" ? null : Number.parseInt(s, 10));
const digits = (s: string) => s.replace(/\D/g, "").slice(0, 2);

const toInput = (r: MatchRow) => ({
  id: r.id,
  round: num(r.round),
  playedOn: r.playedOn || null,
  opponent: r.opponent,
  venue: r.venue,
  half: r.half,
  goalsFor: num(r.goalsFor),
  goalsAgainst: num(r.goalsAgainst),
  comment: r.comment,
});

export function MatchesEditor({
  clubId,
  seasonId,
  initial,
  copy,
  common,
}: {
  clubId: string;
  seasonId: string;
  initial: Match[];
  copy: ResultsCopy;
  common: CommonCopy;
}) {
  const resultLabel = (r: MatchRow) => {
    const o = outcome({ goalsFor: num(r.goalsFor), goalsAgainst: num(r.goalsAgainst) });
    return o === "W" ? copy.win : o === "D" ? copy.draw : o === "L" ? copy.loss : copy.notPlayed;
  };

  return (
    <section aria-labelledby="matches" className="flex flex-col gap-3">
      <div>
        <h3 id="matches" className="text-lg font-semibold">
          {copy.matchesTitle}
        </h3>
        <p className="text-sm text-muted">{copy.matchesHint}</p>
      </div>
      <RowList<MatchRow>
        initial={initial.map(toRow)}
        blank={() => ({
          id: null,
          round: "",
          playedOn: null,
          opponent: "",
          venue: null,
          half: null,
          goalsFor: "",
          goalsAgainst: "",
          comment: null,
        })}
        save={(r) => saveMatch(clubId, seasonId, toInput(r))}
        remove={(id) => deleteMatch(clubId, seasonId, id)}
        nameOf={(r) => r.opponent || copy.newMatch}
        label={copy.matchesTitle}
        itemLabel={(r) => [r.round && `${copy.round} ${r.round}`, r.opponent || copy.newMatch].filter(Boolean).join(", ")}
        addLabel={copy.addMatch}
        emptyLabel={copy.noMatches}
        common={common}
        render={(r, set) => (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[4rem_9.5rem_1fr_7rem_7rem_4.5rem_4.5rem]">
            <Field label={copy.round}>
              <input className={input} inputMode="numeric" value={r.round} onChange={(e) => set({ round: digits(e.target.value) })} />
            </Field>
            <Field label={copy.date}>
              <input className={input} type="date" value={r.playedOn ?? ""} onChange={(e) => set({ playedOn: e.target.value || null })} />
            </Field>
            <Field label={copy.opponent} wide>
              <input className={input} value={r.opponent} maxLength={80} onChange={(e) => set({ opponent: e.target.value })} />
            </Field>
            <Field label={copy.venue}>
              <select
                className={input}
                value={r.venue ?? ""}
                onChange={(e) => set({ venue: (e.target.value || null) as MatchRow["venue"] })}
              >
                <option value="">–</option>
                <option value="home">{copy.home}</option>
                <option value="away">{copy.away}</option>
              </select>
            </Field>
            <Field label={copy.half}>
              <select
                className={input}
                value={r.half ?? ""}
                onChange={(e) => set({ half: (e.target.value || null) as MatchRow["half"] })}
              >
                <option value="">–</option>
                <option value="spring">{copy.spring}</option>
                <option value="autumn">{copy.autumn}</option>
              </select>
            </Field>
            <Field label={copy.goalsFor}>
              <input className={input} inputMode="numeric" value={r.goalsFor} onChange={(e) => set({ goalsFor: digits(e.target.value) })} />
            </Field>
            <Field label={copy.goalsAgainst}>
              <input
                className={input}
                inputMode="numeric"
                value={r.goalsAgainst}
                onChange={(e) => set({ goalsAgainst: digits(e.target.value) })}
              />
            </Field>
            <Field label={copy.comment} full>
              <input className={input} value={r.comment ?? ""} maxLength={300} onChange={(e) => set({ comment: e.target.value || null })} />
            </Field>
            <p className="col-span-2 text-sm sm:col-span-7">
              <span className="text-muted">{copy.result}:</span> <span className="font-medium">{resultLabel(r)}</span>
            </p>
          </div>
        )}
        footer={(rows) => {
          const record = matchRecord(rows.map((r) => ({ goalsFor: num(r.goalsFor), goalsAgainst: num(r.goalsAgainst) })));
          return record.played > 0 ? (
            <p className="text-sm text-muted">
              {record.played} {copy.matchesTitle.toLowerCase()} · {record.won}–{record.drawn}–{record.lost} · {record.goalsFor}–
              {record.goalsAgainst}
            </p>
          ) : null;
        }}
      />
    </section>
  );
}

function Field({ label, children, wide, full }: { label: string; children: React.ReactNode; wide?: boolean; full?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? "col-span-2 sm:col-span-1" : ""} ${full ? "col-span-2 sm:col-span-7" : ""}`}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}
