"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { createSeason } from "./actions";
import { buttonPrimary, card, input, label as labelClass } from "./ui";

export function CreateSeason({
  clubId,
  suggestion,
  copy,
}: {
  clubId: string;
  suggestion: string;
  copy: { title: string; hint: string; label: string; submit: string; saving: string };
}) {
  const router = useRouter();
  const [value, setValue] = useState(suggestion);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const id = useId();

  return (
    <section className={card} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-lg font-semibold">
        {copy.title}
      </h2>
      <p className="mt-1 max-w-prose text-sm text-muted">{copy.hint}</p>
      <form
        className="mt-3 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          start(async () => {
            const result = await createSeason(clubId, value);
            if (!result.ok) setError(result.message);
            else router.push(`/klubb/${clubId}/sasong/${result.id}/planering`);
          });
        }}
      >
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{copy.label}</span>
          <input
            className={`${input} w-32`}
            value={value}
            maxLength={20}
            required
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <button type="submit" className={buttonPrimary} disabled={pending}>
          {pending ? copy.saving : copy.submit}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
