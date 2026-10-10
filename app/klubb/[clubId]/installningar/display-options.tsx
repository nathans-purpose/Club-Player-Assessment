"use client";

import { useActionState, useState } from "react";
import { saveDisplayOptions, type DisplayOptionsState } from "./actions";

type Copy = Record<
  "title" | "anonymous" | "anonymousHint" | "screenFriendly" | "screenFriendlyHint" | "save" | "saving" | "saved",
  string
>;

export function DisplayOptions({
  clubId,
  initial,
  copy,
}: {
  clubId: string;
  initial: { anonymousLeaderView: boolean; screenFriendly: boolean };
  copy: Copy;
}) {
  const [state, action, pending] = useActionState<DisplayOptionsState, FormData>(
    saveDisplayOptions.bind(null, clubId),
    { status: "idle" },
  );
  // Controlled, because React resets uncontrolled fields after a form action.
  const [values, setValues] = useState(initial);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold">{copy.title}</h2>
      <Option
        name="anonymousLeaderView"
        label={copy.anonymous}
        hint={copy.anonymousHint}
        checked={values.anonymousLeaderView}
        onChange={(checked) => setValues((v) => ({ ...v, anonymousLeaderView: checked }))}
      />
      <Option
        name="screenFriendly"
        label={copy.screenFriendly}
        hint={copy.screenFriendlyHint}
        checked={values.screenFriendly}
        onChange={(checked) => setValues((v) => ({ ...v, screenFriendly: checked }))}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-on-primary hover:opacity-90 disabled:opacity-60"
        >
          {pending ? copy.saving : copy.save}
        </button>
        <p role="status" className="text-sm">
          {!pending && state.status === "saved" && copy.saved}
        </p>
      </div>
      {state.status === "error" && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}

function Option({
  name,
  label,
  hint,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-5 shrink-0 accent-[var(--primary)]"
      />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-muted">{hint}</span>
      </span>
    </label>
  );
}
