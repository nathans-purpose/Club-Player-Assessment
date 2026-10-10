"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteClub, deletePlayer } from "./actions";

type PlayerCopy = {
  remove: string;
  removeLabel: string;
  confirmTitle: string;
  confirmBody: string;
  confirm: string;
  cancel: string;
  removed: string;
  inactive: string;
};

/** Every player in the squad, each with a hard delete behind a confirmation. */
export function PlayerDeletion({
  clubId,
  players,
  copy,
}: {
  clubId: string;
  players: { id: string; label: string; active: boolean }[];
  copy: PlayerCopy;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<{ id: string; label: string } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    if (!target) return;
    const removed = target;
    startTransition(async () => {
      const result = await deletePlayer(clubId, removed.id);
      setTarget(null);
      setMessage(
        result.ok
          ? { ok: true, text: copy.removed.replace("{name}", removed.label) }
          : { ok: false, text: result.message ?? "" },
      );
      if (result.ok) router.refresh();
    });
  }

  return (
    <>
      <p role="status" className={message?.ok ? "text-sm font-medium" : "sr-only"}>
        {message?.ok ? message.text : ""}
      </p>
      {message && !message.ok && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
          {message.text}
        </p>
      )}
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {players.map((p) => (
          <li key={p.id} className="flex min-h-11 items-center justify-between gap-3 px-3 py-1">
            <span>
              {p.label}
              {!p.active && <span className="ml-2 text-sm text-muted">({copy.inactive})</span>}
            </span>
            <button
              type="button"
              onClick={() => setTarget(p)}
              aria-label={copy.removeLabel.replace("{name}", p.label)}
              className="min-h-11 rounded-lg px-3 text-sm font-medium text-danger hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-danger"
            >
              {copy.remove}
            </button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={target !== null}
        title={copy.confirmTitle.replace("{name}", target?.label ?? "")}
        confirmLabel={copy.confirm}
        cancelLabel={copy.cancel}
        pending={pending}
        onConfirm={confirm}
        onCancel={() => setTarget(null)}
      >
        <p>{copy.confirmBody}</p>
      </ConfirmDialog>
    </>
  );
}

type ClubCopy = {
  open: string;
  confirmTitle: string;
  confirmBody: string;
  nameLabel: string;
  confirm: string;
  cancel: string;
};

/** Deletes the whole club; the admin types the club's name to confirm. */
export function ClubDeletion({ clubId, clubName, copy }: { clubId: string; clubName: string; copy: ClubCopy }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputId = useId();
  const matches = name.trim() === clubName.trim();

  function confirm() {
    setError(null);
    startTransition(async () => {
      // Redirects away when it succeeds.
      const result = await deleteClub(clubId, name);
      if (!result.ok) setError(result.message ?? "");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 self-start rounded-lg border border-danger px-4 font-semibold text-danger hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-danger"
      >
        {copy.open}
      </button>
      <ConfirmDialog
        open={open}
        title={copy.confirmTitle}
        confirmLabel={copy.confirm}
        cancelLabel={copy.cancel}
        pending={pending}
        confirmDisabled={!matches}
        onConfirm={confirm}
        onCancel={() => {
          setOpen(false);
          setName("");
          setError(null);
        }}
      >
        <p>{copy.confirmBody}</p>
        <label htmlFor={inputId} className="text-sm font-medium">
          {copy.nameLabel.replace("{name}", clubName)}
        </label>
        <input
          id={inputId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          className="min-h-11 rounded-lg border border-border bg-surface px-3 focus-visible:outline-2 focus-visible:outline-primary-ink"
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
