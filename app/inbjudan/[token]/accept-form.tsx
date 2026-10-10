"use client";

import { useActionState } from "react";
import { acceptInvite, type AcceptInviteState } from "./actions";

export function AcceptForm({ token, submit, submitting }: { token: string; submit: string; submitting: string }) {
  const [state, formAction, pending] = useActionState<AcceptInviteState, FormData>(acceptInvite.bind(null, token), {
    status: "idle",
  });
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.status === "error" && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-on-primary hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {pending ? submitting : submit}
      </button>
    </form>
  );
}
