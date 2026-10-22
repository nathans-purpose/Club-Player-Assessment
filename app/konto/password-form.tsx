"use client";

import { useActionState } from "react";
import { setPassword, type PasswordState } from "./actions";

export type PasswordCopy = {
  password: string;
  confirm: string;
  hint: string;
  save: string;
  saving: string;
  saved: string;
};

export function PasswordForm({ email, copy }: { email: string; copy: PasswordCopy }) {
  const [state, formAction, pending] = useActionState<PasswordState, FormData>(setPassword, { status: "idle" });

  return (
    <form action={formAction} className="flex flex-col gap-2" noValidate>
      {/* Lets password managers save the login under the right address. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <label htmlFor="password" className="font-medium">
        {copy.password}
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        aria-describedby="password-hint"
        aria-invalid={state.status === "error"}
        className="min-h-11 rounded-lg border border-border bg-surface px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink"
      />
      <p id="password-hint" className="text-sm text-muted">
        {copy.hint}
      </p>
      <label htmlFor="confirm" className="mt-2 font-medium">
        {copy.confirm}
      </label>
      <input
        id="confirm"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        aria-invalid={state.status === "error"}
        className="min-h-11 rounded-lg border border-border bg-surface px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink"
      />
      {state.status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
      {state.status === "saved" && (
        <p role="status" className="text-sm font-medium">
          {copy.saved}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 min-h-11 self-start rounded-lg bg-primary px-4 font-semibold text-on-primary hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink"
      >
        {pending ? copy.saving : copy.save}
      </button>
    </form>
  );
}
