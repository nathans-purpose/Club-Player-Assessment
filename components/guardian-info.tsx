"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmGuardianInfo } from "@/app/klubb/[clubId]/installningar/data/actions";
import { CopyButton } from "./copy-button";

export type GuardianInfoCopy = {
  title: string;
  intro: string;
  copy: string;
  copied: string;
  confirm: string;
  confirmed: string;
};

/**
 * The information text for guardians (teams with players under 18), shown to
 * admins before the club starts assessing. The admin copies it, sends it on
 * their own and confirms here.
 */
export function GuardianInfo({
  clubId,
  text,
  confirmedOn,
  copy,
}: {
  clubId: string;
  text: string;
  confirmedOn: string | null;
  copy: GuardianInfoCopy;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section
      aria-labelledby="guardian-info-title"
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
    >
      <h2 id="guardian-info-title" className="text-lg font-semibold">
        {copy.title}
      </h2>
      <p className="text-sm text-muted">{copy.intro}</p>
      <p className="whitespace-pre-line rounded-lg bg-surface-muted p-3 text-sm">{text}</p>
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton value={text} label={copy.copy} copiedLabel={copy.copied} />
        {confirmedOn ? (
          <p className="text-sm font-medium">{copy.confirmed.replace("{date}", confirmedOn)}</p>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await confirmGuardianInfo(clubId);
                if (result.ok) router.refresh();
                else setError(result.message ?? "");
              })
            }
            className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink disabled:opacity-60"
          >
            {copy.confirm}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
