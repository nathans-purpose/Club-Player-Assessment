"use client";

import { useState, useTransition } from "react";
import { undoSkip } from "./actions";

/** Shown instead of the form when the leader has skipped the player. */
export function SkippedNotice({
  clubId,
  playerId,
  copy,
}: {
  clubId: string;
  playerId: string;
  copy: { title: string; body: string; undo: string; undoing: string };
}) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold">{copy.title}</h2>
      <p className="text-muted">{copy.body}</p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await undoSkip(clubId, playerId);
            if (!result.ok) setError(result.message);
          })
        }
        className="min-h-11 self-start rounded-lg bg-primary px-5 font-semibold text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink disabled:opacity-60"
      >
        {pending ? copy.undoing : copy.undo}
      </button>
    </section>
  );
}
