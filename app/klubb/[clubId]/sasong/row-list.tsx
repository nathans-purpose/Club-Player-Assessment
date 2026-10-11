"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { CommonCopy } from "@/lib/season/copy";
import type { ActionResult } from "./actions";
import { buttonAdd, buttonDanger, buttonSecondary } from "./ui";

const freshRows = <T,>(rows: Row<T>[], values: T[]): Row<T>[] => {
  const start = Math.max(-1, ...rows.map((r) => r.key)) + 1;
  return [...rows, ...values.map((value, i) => ({ key: start + i, value, saved: null, status: "idle" as const, message: "" }))];
};

type Row<T> = { key: number; value: T; saved: T | null; status: "idle" | "saving" | "saved" | "error"; message: string };

/**
 * A list of rows that are saved one at a time, so several leaders can work in
 * the same list without overwriting each other. New rows exist only here
 * until saved; removing a saved row asks first.
 */
export function RowList<T extends { id: string | null }>({
  initial,
  blank,
  save,
  remove,
  nameOf,
  render,
  label,
  itemLabel,
  addLabel,
  emptyLabel,
  common,
  footer,
  prepend,
}: {
  initial: T[];
  blank: () => T;
  save: (value: T) => Promise<ActionResult>;
  remove: (id: string) => Promise<ActionResult>;
  nameOf: (value: T) => string;
  render: (value: T, set: (change: Partial<T>) => void) => ReactNode;
  label: string;
  itemLabel: (value: T, index: number) => string;
  addLabel: string;
  emptyLabel: string;
  common: CommonCopy;
  footer?: (rows: T[]) => ReactNode;
  /** Values to add as new rows from outside, e.g. suggestions. */
  prepend?: { values: T[]; version: number };
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row<T>[]>(() =>
    initial.map((value, key) => ({ key, value, saved: value, status: "idle", message: "" })),
  );
  const [confirming, setConfirming] = useState<Row<T> | null>(null);
  const [removing, setRemoving] = useState(false);
  const [seenPrepend, setSeenPrepend] = useState(prepend?.version ?? 0);

  // Suggestions picked elsewhere on the page arrive as new, unsaved rows.
  if (prepend && prepend.version !== seenPrepend) {
    setSeenPrepend(prepend.version);
    setRows((r) => freshRows(r, prepend.values));
  }

  const patch = (key: number, change: Partial<Row<T>>) =>
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...change } : row)));

  async function saveRow(row: Row<T>) {
    patch(row.key, { status: "saving", message: "" });
    const result = await save(row.value).catch(() => ({ ok: false as const, message: common.error }));
    if (!result.ok) {
      patch(row.key, { status: "error", message: result.message });
      return;
    }
    const value = { ...row.value, id: result.id ?? row.value.id };
    setRows((r) => r.map((x) => (x.key === row.key ? { ...x, value, saved: value, status: "saved", message: "" } : x)));
    router.refresh();
  }

  async function removeRow(row: Row<T>) {
    if (row.value.id) {
      setRemoving(true);
      const result = await remove(row.value.id).catch(() => ({ ok: false as const, message: common.error }));
      setRemoving(false);
      setConfirming(null);
      if (!result.ok) {
        patch(row.key, { status: "error", message: result.message });
        return;
      }
      router.refresh();
    }
    setRows((r) => r.filter((x) => x.key !== row.key));
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? (
        <p className="text-muted">{emptyLabel}</p>
      ) : (
        <ol className="flex flex-col gap-3" aria-label={label}>
          {rows.map((row, index) => {
            const dirty = JSON.stringify(row.value) !== JSON.stringify(row.saved);
            return (
              <li
                key={row.key}
                aria-label={itemLabel(row.value, index)}
                className="rounded-xl border border-border bg-surface p-3"
              >
                {render(row.value, (change) =>
                  patch(row.key, { value: { ...row.value, ...change }, status: "idle", message: "" }),
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className={buttonSecondary}
                    disabled={!dirty || row.status === "saving"}
                    onClick={() => saveRow(row)}
                  >
                    {row.status === "saving" ? common.saving : common.save}
                  </button>
                  <button
                    type="button"
                    className={buttonDanger}
                    onClick={() => (row.value.id ? setConfirming(row) : removeRow(row))}
                  >
                    {common.remove}
                  </button>
                  <span className="text-sm text-muted" aria-live="polite">
                    {row.status === "error"
                      ? row.message || common.error
                      : dirty
                        ? common.unsaved
                        : row.status === "saved"
                          ? common.saved
                          : ""}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <button
        type="button"
        className={buttonAdd}
        onClick={() => setRows((r) => freshRows(r, [blank()]))}
      >
        {addLabel}
      </button>
      {footer?.(rows.map((r) => r.value))}
      <ConfirmDialog
        open={confirming !== null}
        title={common.removeTitle.replace("{name}", confirming ? nameOf(confirming.value) : "")}
        confirmLabel={common.remove}
        cancelLabel={common.cancel}
        pending={removing}
        onConfirm={() => confirming && removeRow(confirming)}
        onCancel={() => setConfirming(null)}
      >
        <p>{common.removeBody}</p>
      </ConfirmDialog>
    </div>
  );
}
