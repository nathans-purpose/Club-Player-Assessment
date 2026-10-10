"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { isValidEmail } from "@/lib/email";
import { createInvites, type CreateInvitesState } from "./actions";

type Copy = Record<
  | "email"
  | "emailPlaceholder"
  | "role"
  | "leader"
  | "admin"
  | "rowLabel"
  | "removeLabel"
  | "addRow"
  | "submit"
  | "submitting"
  | "invalidEmail"
  | "created"
  | "createdOne"
  | "skipped",
  string
>;

type Row = { key: number; email: string; role: "leader" | "admin"; touched: boolean };

const inputClass =
  "min-h-11 w-full rounded-lg border border-border bg-surface px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink aria-invalid:border-danger";

let nextKey = 1;
const emptyRow = (): Row => ({ key: nextKey++, email: "", role: "leader", touched: false });

export function LeadersForm({ clubId, copy }: { clubId: string; copy: Copy }) {
  const [rows, setRows] = useState<Row[]>(() => [emptyRow(), emptyRow()]);
  const [state, formAction, pending] = useActionState<CreateInvitesState, FormData>(createInvites.bind(null, clubId), {
    status: "idle",
  });
  const listRef = useRef<HTMLOListElement>(null);
  const focusKey = useRef<number | null>(null);

  // Start over with empty rows once the invites are created.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "done") setRows([emptyRow(), emptyRow()]);
  }

  useEffect(() => {
    if (focusKey.current === null) return;
    listRef.current?.querySelector<HTMLInputElement>(`[data-row="${focusKey.current}"] input`)?.focus();
    focusKey.current = null;
  }, [rows]);

  const serverErrors = new Map(
    (state.status === "error" ? (state.rowErrors ?? []) : []).map((e) => [e.index, e.message]),
  );
  const errorFor = (row: Row, index: number) =>
    row.touched && row.email.trim() && !isValidEmail(row.email) ? copy.invalidEmail : serverErrors.get(index);

  function update(key: number, patch: Partial<Row>) {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const marked = rows.map((r) => ({ ...r, touched: true }));
    setRows(marked);
    const firstInvalid = marked.find((r) => r.email.trim() && !isValidEmail(r.email));
    if (firstInvalid) {
      event.preventDefault();
      listRef.current?.querySelector<HTMLInputElement>(`[data-row="${firstInvalid.key}"] input`)?.focus();
    }
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="rows" value={JSON.stringify(rows.map(({ email, role }) => ({ email, role })))} />
      <ol ref={listRef} className="flex flex-col gap-2">
        {rows.map((row, index) => {
          const n = index + 1;
          const error = errorFor(row, index);
          const errorId = `invite-error-${row.key}`;
          return (
            <li
              key={row.key}
              data-row={row.key}
              aria-label={copy.rowLabel.replace("{n}", String(n))}
              className="grid grid-cols-[minmax(0,1fr)_2.75rem] gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_2.75rem]"
            >
              <div className="flex flex-col gap-1">
                <label htmlFor={`invite-email-${row.key}`} className="sr-only">
                  {copy.email}, {copy.rowLabel.replace("{n}", String(n))}
                </label>
                <input
                  id={`invite-email-${row.key}`}
                  type="email"
                  autoComplete="off"
                  placeholder={copy.emailPlaceholder}
                  value={row.email}
                  onChange={(e) => update(row.key, { email: e.target.value })}
                  onBlur={() => update(row.key, { touched: true })}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : undefined}
                  className={inputClass}
                />
                {error && (
                  <p id={errorId} className="text-sm text-danger">
                    {error}
                  </p>
                )}
              </div>
              <div className="col-start-1 sm:col-start-auto">
                <label htmlFor={`invite-role-${row.key}`} className="sr-only">
                  {copy.role}, {copy.rowLabel.replace("{n}", String(n))}
                </label>
                <select
                  id={`invite-role-${row.key}`}
                  value={row.role}
                  onChange={(e) => update(row.key, { role: e.target.value as Row["role"] })}
                  className={inputClass}
                >
                  <option value="leader">{copy.leader}</option>
                  <option value="admin">{copy.admin}</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                disabled={rows.length === 1}
                aria-label={copy.removeLabel.replace("{n}", String(n))}
                className="col-start-2 row-start-1 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-lg hover:bg-surface-muted disabled:opacity-40 sm:col-start-auto sm:row-start-auto"
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={() => {
          const row = emptyRow();
          focusKey.current = row.key;
          setRows((current) => [...current, row]);
        }}
        className="min-h-11 self-start rounded-lg border border-dashed border-border px-4 font-medium hover:bg-surface-muted"
      >
        {copy.addRow}
      </button>

      {state.status === "error" && state.message && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
          {state.message}
        </p>
      )}
      {state.status === "done" && (
        <div role="status" className="flex flex-col gap-1 rounded-lg border border-border bg-surface-muted p-3 text-sm">
          {state.created === 1 && <p>{copy.createdOne}</p>}
          {(state.created ?? 0) > 1 && <p>{copy.created.replace("{count}", String(state.created))}</p>}
          {state.skipped && state.skipped.length > 0 && (
            <p className="break-words text-muted">{copy.skipped.replace("{emails}", state.skipped.join(", "))}</p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 self-start rounded-lg bg-primary px-4 font-semibold text-on-primary hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink"
      >
        {pending ? copy.submitting : copy.submit}
      </button>
    </form>
  );
}
