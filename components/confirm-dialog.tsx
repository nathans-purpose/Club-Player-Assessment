"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * A modal confirmation for destructive actions. The native modal dialog keeps
 * focus inside it, Esc cancels, and focus returns to where it was.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  pending = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => {
        onCancel();
        returnFocus.current?.focus();
      }}
      className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-xl border border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/50"
    >
      {open && (
        <div className="flex flex-col gap-4 p-5">
          <h2 id={titleId} className="text-xl font-bold">
            {title}
          </h2>
          <div className="flex flex-col gap-3">{children}</div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => ref.current?.close()}
              disabled={pending}
              className="min-h-11 rounded-lg border border-border px-4 font-medium hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary-ink"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending || confirmDisabled}
              className="min-h-11 rounded-lg bg-danger px-4 font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:opacity-50"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
