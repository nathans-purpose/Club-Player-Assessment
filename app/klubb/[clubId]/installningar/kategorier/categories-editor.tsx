"use client";

import { useEffect, useId, useState, useTransition } from "react";
import {
  type EditableCategory,
  estimatedMinutes,
  MAX_CATEGORIES,
  MAX_NAME_LENGTH,
  MAX_QUESTION_LENGTH,
  MAX_SUBCATEGORIES,
  move,
  RATINGS_WARNING_ABOVE,
  ratingsPerPlayer,
} from "@/lib/settings/categories";
import { saveCategories } from "./actions";
import type { CategoriesCopy } from "./page";

const UNDO_MS = 5000;

const inputClass =
  "min-h-11 w-full rounded-lg border border-border bg-surface px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink";
const smallButton =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-muted disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary-ink";

// Local rows carry a key for React and, while "Fördjupa" is off, the
// subcategories the admin had typed, so switching it back on restores them.
type Sub = { key: number; id: string | null; name: string };
type Row = { key: number; id: string | null; name: string; question: string; subs: Sub[]; deepened: boolean; stash: Sub[] };

let nextKey = 1;

function toRows(categories: EditableCategory[]): Row[] {
  return categories.map((c) => ({
    key: nextKey++,
    id: c.id,
    name: c.name,
    question: c.question,
    subs: c.subcategories.map((s) => ({ key: nextKey++, id: s.id, name: s.name })),
    deepened: c.subcategories.length > 0,
    stash: [],
  }));
}

function toPayload(rows: Row[]): EditableCategory[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    question: r.question,
    subcategories: r.deepened ? r.subs.map((s) => ({ id: s.id, name: s.name })) : [],
  }));
}

export function CategoriesEditor({
  clubId,
  initialActive,
  initialRemoved,
  playerCount,
  copy,
}: {
  clubId: string;
  initialActive: EditableCategory[];
  initialRemoved: EditableCategory[];
  playerCount: number;
  copy: CategoriesCopy;
}) {
  const [rows, setRows] = useState<Row[]>(() => toRows(initialActive));
  const [removed, setRemoved] = useState<EditableCategory[]>(initialRemoved);
  const [saved, setSaved] = useState(() => JSON.stringify(toPayload(toRows(initialActive))));
  const [undo, setUndo] = useState<{ row: Row; index: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const baseId = useId();

  const payload = toPayload(rows);
  const dirty = JSON.stringify(payload) !== saved;
  const ratings = ratingsPerPlayer(payload);
  const minutes = estimatedMinutes(ratings, playerCount);

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update(index: number, change: Partial<Row>) {
    setJustSaved(false);
    setRows((current) => current.map((r, i) => (i === index ? { ...r, ...change } : r)));
  }

  function updateSub(index: number, subIndex: number, name: string) {
    update(index, { subs: rows[index].subs.map((s, i) => (i === subIndex ? { ...s, name } : s)) });
  }

  function toggleDeepen(index: number, on: boolean) {
    const row = rows[index];
    if (on) {
      const subs = row.stash.length > 0 ? row.stash : [{ key: nextKey++, id: null, name: "" }];
      update(index, { deepened: true, subs, stash: [] });
    } else {
      update(index, { deepened: false, subs: [], stash: row.subs });
    }
  }

  function removeRow(index: number) {
    setJustSaved(false);
    setUndo({ row: rows[index], index });
    setRows((current) => current.filter((_, i) => i !== index));
  }

  function undoRemove() {
    if (!undo) return;
    const { row, index } = undo;
    setRows((current) => [...current.slice(0, index), row, ...current.slice(index)]);
    setUndo(null);
  }

  function addRow() {
    setJustSaved(false);
    setRows((current) => [
      ...current,
      { key: nextKey++, id: null, name: "", question: "", subs: [], deepened: false, stash: [] },
    ]);
  }

  function restore(category: EditableCategory) {
    setJustSaved(false);
    setRemoved((current) => current.filter((c) => c.id !== category.id));
    setRows((current) => [...current, ...toRows([category])]);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveCategories(clubId, payload);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const fresh = toRows(result.active);
      setRows(fresh);
      setRemoved(result.removed);
      setSaved(JSON.stringify(toPayload(fresh)));
      setUndo(null);
      setJustSaved(true);
    });
  }

  const label = (row: Row) => row.name.trim() || copy.untitled;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{copy.historyNote}</p>
        <ol aria-label={copy.listLabel} className="flex flex-col gap-3">
          {rows.map((row, index) => {
            const id = `${baseId}-${row.key}`;
            return (
              <li key={row.key} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-0 flex-1 basis-48">
                    <label htmlFor={`${id}-name`} className="text-sm font-medium">
                      {copy.name}
                    </label>
                    <input
                      id={`${id}-name`}
                      value={row.name}
                      maxLength={MAX_NAME_LENGTH}
                      placeholder={copy.newCategory}
                      onChange={(e) => update(index, { name: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRows((current) => move(current, index, -1))}
                      disabled={index === 0}
                      aria-label={copy.moveUp.replace("{name}", label(row))}
                      className={smallButton}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => setRows((current) => move(current, index, 1))}
                      disabled={index === rows.length - 1}
                      aria-label={copy.moveDown.replace("{name}", label(row))}
                      className={smallButton}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      aria-label={copy.removeLabel.replace("{name}", label(row))}
                      className={`${smallButton} text-danger`}
                    >
                      {copy.remove}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor={`${id}-question`} className="text-sm font-medium">
                    {copy.question}
                  </label>
                  <input
                    id={`${id}-question`}
                    value={row.question}
                    maxLength={MAX_QUESTION_LENGTH}
                    aria-describedby={`${id}-question-hint`}
                    onChange={(e) => update(index, { question: e.target.value })}
                    className={inputClass}
                  />
                  <p id={`${id}-question-hint`} className="mt-1 text-xs text-muted">
                    {copy.questionHint}
                  </p>
                </div>

                <label className="flex min-h-11 cursor-pointer items-center gap-3 self-start">
                  <input
                    type="checkbox"
                    checked={row.deepened}
                    onChange={(e) => toggleDeepen(index, e.target.checked)}
                    className="size-5 accent-[var(--primary)]"
                  />
                  <span>
                    <span className="font-medium">{copy.deepen}</span>{" "}
                    <span className="text-sm text-muted">{copy.deepenHint}</span>
                  </span>
                </label>

                {row.deepened && (
                  <fieldset className="flex flex-col gap-2 border-l-2 border-primary/40 pl-3">
                    <legend className="mb-1 text-sm font-medium">
                      {copy.subcategories.replace("{name}", label(row))}
                    </legend>
                    {row.subs.map((sub, subIndex) => {
                      const n = String(subIndex + 1);
                      return (
                        <div key={sub.key} className="flex gap-2">
                          <input
                            aria-label={copy.subcategoryName.replace("{n}", n)}
                            value={sub.name}
                            maxLength={MAX_NAME_LENGTH}
                            onChange={(e) => updateSub(index, subIndex, e.target.value)}
                            className={inputClass}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const subs = row.subs.filter((_, i) => i !== subIndex);
                              // The last subcategory gone means the category is no longer deepened.
                              update(index, subs.length ? { subs } : { subs, deepened: false });
                            }}
                            aria-label={copy.removeSubcategory.replace("{n}", n)}
                            className={smallButton}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                    {row.subs.length < MAX_SUBCATEGORIES && (
                      <button
                        type="button"
                        onClick={() => update(index, { subs: [...row.subs, { key: nextKey++, id: null, name: "" }] })}
                        className="min-h-11 self-start rounded-lg border border-dashed border-border px-3 text-sm font-medium hover:bg-surface-muted"
                      >
                        {copy.addSubcategory}
                      </button>
                    )}
                  </fieldset>
                )}
              </li>
            );
          })}
        </ol>

        {undo && (
          <div
            role="status"
            className="flex flex-wrap items-center gap-3 self-start rounded-lg bg-foreground px-4 py-2 text-sm text-background"
          >
            {copy.removed.replace("{name}", label(undo.row))}
            <button type="button" onClick={undoRemove} className="min-h-11 px-2 font-semibold underline">
              {copy.undo}
            </button>
          </div>
        )}

        {rows.length < MAX_CATEGORIES ? (
          <button
            type="button"
            onClick={addRow}
            className="min-h-11 self-start rounded-lg border border-dashed border-border px-4 font-medium hover:bg-surface-muted"
          >
            {copy.addCategory}
          </button>
        ) : (
          <p className="text-sm text-muted">{copy.maxCategories}</p>
        )}

        {removed.length > 0 && (
          <section aria-labelledby={`${baseId}-removed`} className="flex flex-col gap-2">
            <h2 id={`${baseId}-removed`} className="font-semibold">
              {copy.removedTitle}
            </h2>
            <p className="text-sm text-muted">{copy.removedHint}</p>
            <ul className="flex flex-col gap-2">
              {removed.map((c) => (
                <li
                  key={c.id}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3"
                >
                  <span className="text-muted">{c.name}</span>
                  <button
                    type="button"
                    onClick={() => restore(c)}
                    disabled={rows.length >= MAX_CATEGORIES}
                    aria-label={copy.restoreLabel.replace("{name}", c.name)}
                    className="min-h-11 px-2 text-sm font-semibold underline disabled:opacity-40"
                  >
                    {copy.restore}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 px-4 py-3">
          <button
            type="button"
            onClick={save}
            disabled={pending || !dirty}
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

      <aside aria-labelledby={`${baseId}-summary`} className="lg:sticky lg:top-6 lg:self-start">
        <div
          className={`flex flex-col gap-2 rounded-lg border p-4 ${
            ratings > RATINGS_WARNING_ABOVE ? "border-scale-mid bg-scale-mid/15" : "border-border bg-surface-muted"
          }`}
        >
          <h2 id={`${baseId}-summary`} className="font-semibold">
            {copy.summaryTitle}
          </h2>
          <p className="text-2xl font-bold">{copy.summaryRatings.replace("{n}", String(ratings))}</p>
          <p className="text-sm">
            {(playerCount > 0 ? copy.summaryMinutes : copy.summaryMinutesNoPlayers)
              .replace("{perPlayer}", String(minutes.perPlayer))
              .replace("{squad}", String(minutes.squad))
              .replace("{players}", String(playerCount))}
          </p>
          {ratings > RATINGS_WARNING_ABOVE && (
            <p role="note" className="text-sm font-medium">
              ⚠ {copy.summaryWarning}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
