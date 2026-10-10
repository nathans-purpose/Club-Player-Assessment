"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ImportedRow, UncertainField } from "@/lib/players/import/schema";
import { parsePlayerLines } from "@/lib/players/parse";
import { needsCheck, reviewStatuses, type ReviewRow, type ReviewStatus } from "@/lib/players/review";
import { SQUAD_GROUPS, type SquadGroup } from "@/lib/players/squad-groups";
import { savePlayers, type SavePlayersState } from "./actions";
import { FileImport, type FileImportCopy } from "./file-import";

type Copy = Record<
  | "pasteTitle"
  | "pasteHint"
  | "pasteLabel"
  | "pasteSubmit"
  | "pasteAdded"
  | "listTitle"
  | "number"
  | "name"
  | "squadGroup"
  | "squadGroupNone"
  | "source"
  | "status"
  | "rowLabel"
  | "remove"
  | "removeLabel"
  | "undo"
  | "removed"
  | "addRow"
  | "filter"
  | "filterEmpty"
  | "summary"
  | "save"
  | "saving"
  | "saveEmpty"
  | "duplicatesBlock"
  | "skip"
  | "uncertain"
  | "confirm"
  | "confirmLabel",
  string
> & {
  statusLabels: Record<ReviewStatus, string>;
  groupLabels: Record<SquadGroup, string>;
  uncertainLabels: Record<UncertainField, string>;
  upload: FileImportCopy;
};

type Row = ReviewRow & { key: number; sourceText?: string };

// Editing a field the importer was unsure about counts as checking it.
const FIELD_OF: Record<"shirtNumber" | "fullName" | "squadGroup", UncertainField> = {
  shirtNumber: "shirt_number",
  fullName: "full_name",
  squadGroup: "squad_group",
};

const UNDO_MS = 5000;

const STATUS_CLASS: Record<ReviewStatus, string> = {
  klar: "border-primary/40 bg-primary/10",
  "kontrollera-stavningen": "border-scale-mid bg-scale-mid/20",
  "nummer-saknas": "border-scale-mid bg-scale-mid/20",
  "valj-lagdel": "border-scale-mid bg-scale-mid/20",
  dubblett: "border-danger/50 bg-danger/10",
};

const inputClass =
  "min-h-11 w-full rounded-lg border border-border bg-surface px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

let nextKey = 1;
const emptyRow = (): Row => ({ key: nextKey++, shirtNumber: "", fullName: "", squadGroup: "" });

export function PlayersEditor({
  clubId,
  existing,
  skipHref,
  copy,
}: {
  clubId: string;
  existing: { shirtNumber: string | null; fullName: string }[];
  skipHref: string;
  copy: Copy;
}) {
  const [rows, setRows] = useState<Row[]>(() => [emptyRow(), emptyRow(), emptyRow()]);
  const [paste, setPaste] = useState("");
  const [pasteMessage, setPasteMessage] = useState("");
  const [onlyNeedsCheck, setOnlyNeedsCheck] = useState(false);
  const [removed, setRemoved] = useState<{ row: Row; index: number } | null>(null);
  const [hasImported, setHasImported] = useState(false);
  const [clientError, setClientError] = useState("");
  const [state, formAction, pending] = useActionState<SavePlayersState, FormData>(savePlayers.bind(null, clubId), {
    status: "idle",
  });
  const focusKey = useRef<number | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const filterId = useId();

  const statuses = useMemo(() => reviewStatuses(rows, existing), [rows, existing]);
  const filled = statuses.filter((s) => s !== null).length;
  const toCheck = statuses.filter(needsCheck).length;
  const hasDuplicates = statuses.includes("dubblett");

  // Focus the first field of a newly added row.
  useEffect(() => {
    if (focusKey.current === null) return;
    listRef.current?.querySelector<HTMLInputElement>(`[data-row="${focusKey.current}"] input`)?.focus();
    focusKey.current = null;
  }, [rows]);

  useEffect(() => {
    if (!removed) return;
    const timer = setTimeout(() => setRemoved(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [removed]);

  function update(key: number, patch: Partial<Pick<Row, "shirtNumber" | "fullName" | "squadGroup">>) {
    setClientError("");
    const checked = (Object.keys(patch) as (keyof typeof FIELD_OF)[]).map((f) => FIELD_OF[f]);
    setRows((current) =>
      current.map((r) =>
        r.key === key ? { ...r, ...patch, uncertainFields: r.uncertainFields?.filter((f) => !checked.includes(f)) } : r,
      ),
    );
  }

  /** The admin has checked what the importer was unsure about. */
  function confirmRow(key: number) {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, uncertainFields: [] } : r)));
  }

  /** Appends rows to the list, replacing the empty rows at the end. */
  function append(added: Row[]) {
    setOnlyNeedsCheck(false);
    setRows((current) => [
      ...current.filter((r) => r.shirtNumber.trim() || r.fullName.trim() || r.squadGroup),
      ...added,
    ]);
  }

  function addFromFile(imported: ImportedRow[]) {
    setHasImported(true);
    append(imported.map((r) => ({ key: nextKey++, ...r })));
  }

  function addRow() {
    const row = emptyRow();
    focusKey.current = row.key;
    setOnlyNeedsCheck(false);
    setRows((current) => [...current, row]);
  }

  function removeRow(index: number) {
    setRemoved({ row: rows[index], index });
    setRows((current) => current.filter((_, i) => i !== index));
  }

  function undoRemove() {
    if (!removed) return;
    const { row, index } = removed;
    setRows((current) => [...current.slice(0, index), row, ...current.slice(index)]);
    setRemoved(null);
  }

  function addFromPaste() {
    const parsed = parsePlayerLines(paste);
    if (parsed.length === 0) return;
    append(
      parsed.map((p) => ({
        key: nextKey++,
        shirtNumber: p.shirtNumber ?? "",
        fullName: p.fullName,
        squadGroup: p.squadGroup ?? ("" as const),
        sourceText: p.sourceText,
      })),
    );
    setPaste("");
    setPasteMessage(copy.pasteAdded.replace("{count}", String(parsed.length)));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const message = filled === 0 ? copy.saveEmpty : hasDuplicates ? copy.duplicatesBlock : "";
    setClientError(message);
    if (!message) return;
    event.preventDefault();
    if (hasDuplicates) {
      const first = rows[statuses.indexOf("dubblett")];
      listRef.current?.querySelector<HTMLInputElement>(`[data-row="${first.key}"] input`)?.focus();
    }
  }

  const error = clientError || (state.status === "error" ? state.message : "");
  const visible = rows.map((row, index) => ({ row, index, status: statuses[index] }));
  const shown = onlyNeedsCheck ? visible.filter((v) => needsCheck(v.status)) : visible;

  return (
    <div className="flex flex-col gap-6">
      <FileImport clubId={clubId} hasImported={hasImported} onRows={addFromFile} copy={copy.upload} />

      <section aria-labelledby="paste-title" className="rounded-xl border border-border bg-surface p-4">
        <h2 id="paste-title" className="font-semibold">
          {copy.pasteTitle}
        </h2>
        <p id="paste-hint" className="mt-1 text-sm text-muted">
          {copy.pasteHint}
        </p>
        <label htmlFor="paste" className="sr-only">
          {copy.pasteLabel}
        </label>
        <textarea
          id="paste"
          rows={4}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          aria-describedby="paste-hint"
          className="mt-3 w-full rounded-lg border border-border bg-surface p-3 font-mono text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={addFromPaste}
            disabled={!paste.trim()}
            className="min-h-11 rounded-lg border border-border bg-surface px-4 font-medium hover:bg-surface-muted disabled:opacity-50"
          >
            {copy.pasteSubmit}
          </button>
          <p role="status" className="text-sm text-muted">
            {pasteMessage}
          </p>
        </div>
      </section>

      <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <input
          type="hidden"
          name="rows"
          value={JSON.stringify(
            rows.map(({ shirtNumber, fullName, squadGroup }) => ({ shirtNumber, fullName, squadGroup })),
          )}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">{copy.listTitle}</h2>
          <p className="text-sm text-muted" aria-live="polite">
            {copy.summary.replace("{count}", String(filled)).replace("{check}", String(toCheck))}
          </p>
        </div>

        <label htmlFor={filterId} className="flex min-h-11 cursor-pointer items-center gap-3 self-start">
          <input
            id={filterId}
            type="checkbox"
            checked={onlyNeedsCheck}
            onChange={(e) => setOnlyNeedsCheck(e.target.checked)}
            className="size-5 accent-primary"
          />
          {copy.filter}
        </label>

        <div
          aria-hidden="true"
          className="hidden gap-2 px-3 text-sm font-medium text-muted sm:grid sm:grid-cols-[4.5rem_minmax(0,1fr)_10rem_11rem_2.75rem]"
        >
          <span>{copy.number}</span>
          <span>{copy.name}</span>
          <span>{copy.squadGroup}</span>
          <span>{copy.status}</span>
        </div>

        <ol ref={listRef} className="flex flex-col gap-2">
          {shown.map(({ row, index, status }) => {
            const n = index + 1;
            const label = copy.rowLabel.replace("{n}", String(n));
            const statusId = `status-${row.key}`;
            const unsure = new Set(row.uncertainFields ?? []);
            const unsureClass = (field: UncertainField) => (unsure.has(field) ? " border-dashed border-scale-mid" : "");
            return (
              <li
                key={row.key}
                data-row={row.key}
                aria-label={label}
                className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 rounded-lg border border-border bg-surface p-3 sm:grid-cols-[4.5rem_minmax(0,1fr)_10rem_11rem_2.75rem] sm:items-center"
              >
                <div>
                  <label htmlFor={`nr-${row.key}`} className="text-xs font-medium text-muted sm:sr-only">
                    {copy.number}
                    <span className="sr-only">, {label}</span>
                  </label>
                  <input
                    id={`nr-${row.key}`}
                    inputMode="numeric"
                    maxLength={10}
                    value={row.shirtNumber}
                    onChange={(e) => update(row.key, { shirtNumber: e.target.value })}
                    aria-describedby={status ? statusId : undefined}
                    className={inputClass + unsureClass("shirt_number")}
                  />
                </div>
                <div>
                  <label htmlFor={`name-${row.key}`} className="text-xs font-medium text-muted sm:sr-only">
                    {copy.name}
                    <span className="sr-only">, {label}</span>
                  </label>
                  <input
                    id={`name-${row.key}`}
                    maxLength={100}
                    autoComplete="off"
                    value={row.fullName}
                    onChange={(e) => update(row.key, { fullName: e.target.value })}
                    aria-describedby={status ? statusId : undefined}
                    className={inputClass + unsureClass("full_name")}
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label htmlFor={`group-${row.key}`} className="text-xs font-medium text-muted sm:sr-only">
                    {copy.squadGroup}
                    <span className="sr-only">, {label}</span>
                  </label>
                  <select
                    id={`group-${row.key}`}
                    value={row.squadGroup}
                    onChange={(e) => update(row.key, { squadGroup: e.target.value as Row["squadGroup"] })}
                    aria-describedby={status ? statusId : undefined}
                    className={inputClass + unsureClass("squad_group")}
                  >
                    <option value="">{copy.squadGroupNone}</option>
                    {SQUAD_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {copy.groupLabels[g]} ({g})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 flex items-center justify-between gap-2 sm:contents">
                  <div className="flex min-h-11 items-center">
                    {status && (
                      <span
                        id={statusId}
                        className={`rounded-full border px-2.5 py-1 text-sm font-medium ${STATUS_CLASS[status]}`}
                      >
                        {copy.statusLabels[status]}
                        {unsure.size > 0 && (
                          <span className="sr-only">
                            {" "}
                            {copy.uncertain.replace(
                              "{fields}",
                              [...unsure].map((f) => copy.uncertainLabels[f]).join(", "),
                            )}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    aria-label={copy.removeLabel.replace("{n}", String(n))}
                    title={copy.remove}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border px-3 text-sm hover:bg-surface-muted sm:border-0 sm:px-0"
                  >
                    <span aria-hidden="true" className="hidden text-lg sm:inline">
                      ×
                    </span>
                    <span className="sm:hidden">{copy.remove}</span>
                  </button>
                </div>
                {(row.sourceText || unsure.size > 0) && (
                  <div className="col-span-2 flex flex-col gap-0.5 text-xs text-muted sm:col-span-5">
                    {unsure.size > 0 && (
                      <div className="flex flex-wrap items-center gap-x-3">
                        <p aria-hidden="true">
                          {copy.uncertain.replace(
                            "{fields}",
                            [...unsure].map((f) => copy.uncertainLabels[f]).join(", "),
                          )}
                        </p>
                        <button
                          type="button"
                          onClick={() => confirmRow(row.key)}
                          aria-label={copy.confirmLabel.replace("{n}", String(n))}
                          className="min-h-11 font-medium text-foreground underline"
                        >
                          {copy.confirm}
                        </button>
                      </div>
                    )}
                    {row.sourceText && (
                      <p>
                        {copy.source}: <span className="font-mono">{row.sourceText}</span>
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        {onlyNeedsCheck && shown.length === 0 && <p className="text-muted">{copy.filterEmpty}</p>}

        {removed && (
          <div
            role="status"
            className="flex flex-wrap items-center gap-3 self-start rounded-lg bg-foreground px-4 py-2 text-sm text-background"
          >
            {copy.removed}
            <button type="button" onClick={undoRemove} className="min-h-11 px-2 font-semibold underline">
              {copy.undo}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={addRow}
          className="min-h-11 self-start rounded-lg border border-dashed border-border px-4 font-medium hover:bg-surface-muted"
        >
          {copy.addRow}
        </button>

        {error && (
          <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-on-primary hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {pending ? copy.saving : copy.save.replace("{count}", String(filled))}
          </button>
          <Link
            href={skipHref}
            className="flex min-h-11 items-center rounded-lg px-4 font-medium hover:bg-surface-muted"
          >
            {copy.skip}
          </Link>
        </div>
      </form>
    </div>
  );
}
