"use client";

import { useParams, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { saveTexts } from "@/app/klubb/[clubId]/text-actions";
import type { EditableCopy } from "@/lib/i18n";

/*
 * "Redigera texter": an admin turns on edit mode in the header; headings then
 * get a pencil button and body texts a "Redigera text" button. Edits are kept
 * as drafts until the admin presses Spara (or Ångra to drop them).
 */

export type TextEditCopy = {
  toggle: string;
  editHeading: string;
  editBody: string;
  done: string;
  cancel: string;
  reset: string;
  edited: string;
  pending: string;
  save: string;
  saving: string;
  undo: string;
  saved: string;
  error: string;
  label: string;
};

type Draft = { value: string; fallback: string };

type TextEditState = {
  editing: boolean;
  setEditing: (editing: boolean) => void;
  drafts: Record<string, Draft>;
  setDraft: (key: string, draft: Draft) => void;
  clearDrafts: () => void;
  copy: TextEditCopy | null;
  setCopy: (copy: TextEditCopy) => void;
};

const TextEditContext = createContext<TextEditState | null>(null);

export function TextEditProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [copy, setCopy] = useState<TextEditCopy | null>(null);
  const value = useMemo<TextEditState>(
    () => ({
      editing,
      setEditing,
      drafts,
      setDraft: (key, draft) => setDrafts((d) => ({ ...d, [key]: draft })),
      clearDrafts: () => setDrafts({}),
      copy,
      setCopy,
    }),
    [editing, drafts, copy],
  );
  return <TextEditContext.Provider value={value}>{children}</TextEditContext.Provider>;
}

/** The header button (admins only) and the Spara / Ångra bar while there are unsaved edits. */
export function TextEditToggle({ copy }: { copy: TextEditCopy }) {
  const state = useContext(TextEditContext);
  const router = useRouter();
  const { clubId } = useParams<{ clubId: string }>();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "saved" | "error"; text: string } | null>(null);
  const setCopy = state?.setCopy;

  useEffect(() => setCopy?.(copy), [setCopy, copy]);

  if (!state) return null;
  const changes = Object.entries(state.drafts);

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveTexts(
        clubId,
        changes.map(([key, d]) => ({ key, value: d.value, fallback: d.fallback })),
      );
      if (result.ok) {
        state?.clearDrafts();
        setMessage({ kind: "saved", text: copy.saved });
        router.refresh();
      } else {
        setMessage({ kind: "error", text: result.message ?? copy.error });
      }
    });
  }

  return (
    <>
      <button
        type="button"
        aria-pressed={state.editing}
        onClick={() => state.setEditing(!state.editing)}
        className={`min-h-11 rounded-lg px-3 text-sm font-medium hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary-ink ${
          state.editing ? "bg-surface-muted text-primary-ink ring-2 ring-primary-ink" : ""
        }`}
      >
        {copy.toggle}
      </button>
      {(changes.length > 0 || message) && (
        <div
          role="region"
          aria-label={copy.label}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <p role="status" className="text-sm">
              {changes.length > 0
                ? copy.pending.replace("{count}", String(changes.length))
                : message?.kind === "saved"
                  ? message.text
                  : null}
            </p>
            {message?.kind === "error" && (
              <p role="alert" className="text-sm text-danger">
                {message.text}
              </p>
            )}
            <div className="flex gap-2">
              {changes.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      state.clearDrafts();
                      setMessage(null);
                    }}
                    disabled={pending}
                    className="min-h-11 rounded-lg border border-border px-4 font-medium hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary-ink"
                  >
                    {copy.undo}
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={pending}
                    className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink disabled:opacity-60"
                  >
                    {pending ? copy.saving : copy.save}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setMessage(null)}
                  className="min-h-11 rounded-lg border border-border px-4 font-medium hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary-ink"
                >
                  {copy.done}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

type Tag = "h1" | "h2" | "h3" | "p";

/**
 * A heading or body text the club's admins can rewrite. Outside edit mode it
 * is just the element with the club's text (or an unsaved draft of it).
 */
export function EditableText({
  textKey,
  value,
  fallback,
  as = "p",
  className,
  id,
}: EditableCopy & { as?: Tag; className?: string; id?: string }) {
  const state = useContext(TextEditContext);
  const [open, setOpen] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  const draft = state?.drafts[textKey];

  // Back to the edit button when the inline editor closes, so keyboard users keep their place.
  useEffect(() => {
    if (!open && refocus.current) {
      refocus.current = false;
      editButton.current?.focus();
    }
  }, [open]);
  const shown = draft ? draft.value.trim() || fallback : value;
  const Element = as;
  const heading = as !== "p";

  if (!state?.editing || !state.copy) {
    return (
      <Element id={id} className={className}>
        {shown}
      </Element>
    );
  }
  const copy = state.copy;

  if (open) {
    return (
      <InlineEditor
        heading={heading}
        initial={shown}
        fallback={fallback}
        copy={copy}
        onClose={(next) => {
          refocus.current = true;
          setOpen(false);
          if (next !== undefined && next !== shown) state.setDraft(textKey, { value: next, fallback });
        }}
      />
    );
  }

  const changed = Boolean(draft);
  const marker = changed ? "outline-2 outline-dashed outline-offset-2 outline-primary-ink" : "";

  if (heading) {
    return (
      <Element id={id} className={`${className ?? ""} ${marker}`}>
        {shown}
        <button
          ref={editButton}
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`${copy.editHeading}: ${shown}`}
          className="ml-2 inline-flex size-11 items-center justify-center rounded-lg align-middle text-base font-normal text-primary-ink hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary-ink"
        >
          <PencilIcon />
        </button>
        {changed && <span className="sr-only"> ({copy.edited})</span>}
      </Element>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Element id={id} className={`${className ?? ""} ${marker}`}>
        {shown}
        {changed && <span className="sr-only"> ({copy.edited})</span>}
      </Element>
      <button
        ref={editButton}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-primary-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary-ink"
      >
        <PencilIcon />
        {copy.editBody}
      </button>
    </div>
  );
}

function InlineEditor({
  heading,
  initial,
  fallback,
  copy,
  onClose,
}: {
  heading: boolean;
  initial: string;
  fallback: string;
  copy: TextEditCopy;
  onClose: (value?: string) => void;
}) {
  const [text, setText] = useState(initial);
  const id = useId();
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => field.current?.focus(), []);

  const fieldClass =
    "w-full rounded-lg border border-border bg-surface px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-primary-ink";
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter" && heading) {
      e.preventDefault();
      onClose(text);
    }
  };

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border-2 border-primary-ink bg-surface p-3">
      <label htmlFor={id} className="text-sm font-medium">
        {heading ? copy.editHeading : copy.editBody}
      </label>
      {heading ? (
        <input
          id={id}
          ref={field}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          className={fieldClass}
        />
      ) : (
        <textarea
          id={id}
          ref={field}
          value={text}
          rows={4}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          className={fieldClass}
        />
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onClose(text)}
          className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink"
        >
          {copy.done}
        </button>
        <button
          type="button"
          onClick={() => onClose()}
          className="min-h-11 rounded-lg border border-border px-4 font-medium hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary-ink"
        >
          {copy.cancel}
        </button>
        {text !== fallback && (
          <button
            type="button"
            onClick={() => setText(fallback)}
            className="min-h-11 rounded-lg px-3 text-sm font-medium text-primary-ink hover:underline focus-visible:outline-2 focus-visible:outline-primary-ink"
          >
            {copy.reset}
          </button>
        )}
      </div>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="currentColor">
      <path d="M13.6 2.6a2 2 0 0 1 2.8 0l1 1a2 2 0 0 1 0 2.8l-9.7 9.7-4.2 1.2a.6.6 0 0 1-.8-.8l1.2-4.2 9.7-9.7Zm-8.6 10.4-.6 2.1 2.1-.6 8.1-8.1-1.5-1.5L5 13Z" />
    </svg>
  );
}
