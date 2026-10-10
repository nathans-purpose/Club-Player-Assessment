"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { GAME_FORMATS } from "@/lib/onboarding/defaults";
import { CREST_MAX_BYTES, CREST_TYPES } from "@/lib/onboarding/crest";
import { createClub, type ClubFormState } from "./actions";

export type ClubFormCopy = Record<
  | "clubName"
  | "clubNamePlaceholder"
  | "teamName"
  | "teamNameHint"
  | "gameFormat"
  | "gameFormatHint"
  | "gameFormatOption"
  | "hasMinors"
  | "hasMinorsHint"
  | "yes"
  | "no"
  | "crest"
  | "crestHint"
  | "crestRemove"
  | "preview"
  | "previewClubName"
  | "previewTeamName"
  | "previewMinors"
  | "submit"
  | "submitting",
  string
>;

const inputClass =
  "min-h-11 w-full rounded-lg border border-border bg-surface px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink aria-invalid:border-danger";

export function ClubForm({ copy }: { copy: ClubFormCopy }) {
  const [state, formAction, pending] = useActionState<ClubFormState, FormData>(createClub, { status: "idle" });
  // Controlled so the live preview follows along and values survive a failed submit.
  const [clubName, setClubName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [gameFormat, setGameFormat] = useState<number>(11);
  const [hasMinors, setHasMinors] = useState<"ja" | "nej" | "">("");
  const [crestUrl, setCrestUrl] = useState<string | null>(null);
  const [crestError, setCrestError] = useState<string | null>(null);
  const crestInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => void (crestUrl && URL.revokeObjectURL(crestUrl)), [crestUrl]);

  // Server errors disappear as soon as the field is filled in.
  const serverErrors = state.fieldErrors ?? {};
  const errors = {
    clubName: clubName.trim() ? undefined : serverErrors.clubName,
    teamName: teamName.trim() ? undefined : serverErrors.teamName,
    gameFormat: serverErrors.gameFormat,
    hasMinors: hasMinors ? undefined : serverErrors.hasMinors,
    crest: serverErrors.crest,
  };
  const crestMessage = crestError ?? errors.crest;

  function onCrestChange(file: File | undefined) {
    setCrestError(null);
    setCrestUrl(null);
    if (!file) return;
    if (!CREST_TYPES[file.type]) {
      setCrestError("Klubbmärket ska vara en PNG-, JPG- eller WebP-bild.");
    } else if (file.size > CREST_MAX_BYTES) {
      setCrestError("Klubbmärket får vara högst 2 MB.");
    } else {
      setCrestUrl(URL.createObjectURL(file));
      return;
    }
    if (crestInput.current) crestInput.current.value = "";
  }

  function removeCrest() {
    setCrestUrl(null);
    setCrestError(null);
    if (crestInput.current) crestInput.current.value = "";
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[minmax(0,1fr)_18rem]">
      <form action={formAction} className="flex flex-col gap-5" noValidate>
        {state.message && (
          <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
            {state.message}
          </p>
        )}

        <Field id="clubName" label={copy.clubName} error={errors.clubName}>
          <input
            id="clubName"
            name="clubName"
            required
            maxLength={100}
            autoComplete="organization"
            placeholder={copy.clubNamePlaceholder}
            value={clubName}
            onChange={(e) => setClubName(e.target.value)}
            aria-invalid={Boolean(errors.clubName)}
            aria-describedby={errors.clubName ? "clubName-error" : undefined}
            className={inputClass}
          />
        </Field>

        <Field id="teamName" label={copy.teamName} hint={copy.teamNameHint} error={errors.teamName}>
          <input
            id="teamName"
            name="teamName"
            required
            maxLength={60}
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            aria-invalid={Boolean(errors.teamName)}
            aria-describedby={`teamName-hint${errors.teamName ? " teamName-error" : ""}`}
            className={inputClass}
          />
        </Field>

        <fieldset className="flex flex-col gap-2" aria-describedby="gameFormat-hint">
          <legend className="font-medium">{copy.gameFormat}</legend>
          <p id="gameFormat-hint" className="-mt-1 text-sm text-muted">
            {copy.gameFormatHint}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GAME_FORMATS.map((n) => (
              <label
                key={n}
                className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 has-checked:border-primary has-checked:bg-primary/10 has-checked:font-semibold has-focus-visible:outline-2 has-focus-visible:outline-primary-ink"
              >
                <input
                  type="radio"
                  name="gameFormat"
                  value={n}
                  checked={gameFormat === n}
                  onChange={() => setGameFormat(n)}
                  className="sr-only"
                />
                {copy.gameFormatOption.replaceAll("{n}", String(n))}
              </label>
            ))}
          </div>
          {errors.gameFormat && <FieldError id="gameFormat-error">{errors.gameFormat}</FieldError>}
        </fieldset>

        <fieldset className="flex flex-col gap-2" aria-describedby="hasMinors-hint">
          <legend className="font-medium">{copy.hasMinors}</legend>
          <p id="hasMinors-hint" className="-mt-1 text-sm text-muted">
            {copy.hasMinorsHint}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:max-w-xs">
            {(["ja", "nej"] as const).map((value) => (
              <label
                key={value}
                className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 has-checked:border-primary has-checked:bg-primary/10 has-checked:font-semibold has-focus-visible:outline-2 has-focus-visible:outline-primary-ink"
              >
                <input
                  type="radio"
                  name="hasMinors"
                  value={value}
                  required
                  checked={hasMinors === value}
                  onChange={() => setHasMinors(value)}
                  className="sr-only"
                />
                {value === "ja" ? copy.yes : copy.no}
              </label>
            ))}
          </div>
          {errors.hasMinors && <FieldError id="hasMinors-error">{errors.hasMinors}</FieldError>}
        </fieldset>

        <Field id="crest" label={copy.crest} hint={copy.crestHint} error={crestMessage}>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={crestInput}
              id="crest"
              name="crest"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => onCrestChange(e.target.files?.[0])}
              aria-invalid={Boolean(crestMessage)}
              aria-describedby={`crest-hint${crestMessage ? " crest-error" : ""}`}
              className="min-h-11 max-w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:font-medium"
            />
            {crestUrl && (
              <button
                type="button"
                onClick={removeCrest}
                className="min-h-11 rounded-lg px-3 text-sm font-medium underline hover:bg-surface-muted"
              >
                {copy.crestRemove}
              </button>
            )}
          </div>
        </Field>

        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-on-primary hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink sm:self-start"
        >
          {pending ? copy.submitting : copy.submit}
        </button>
      </form>

      <aside aria-label={copy.preview} className="md:sticky md:top-6 md:self-start">
        <p className="text-sm font-medium text-muted">{copy.preview}</p>
        <div className="mt-2 flex items-center gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-muted">
            {crestUrl ? (
              // A local object URL, so next/image adds nothing here.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={crestUrl} alt="" className="size-full object-contain" />
            ) : (
              <span aria-hidden="true" className="text-xl font-bold text-muted">
                {initials(clubName)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold">{clubName.trim() || copy.previewClubName}</p>
            <p className="truncate text-muted">{teamName.trim() || copy.previewTeamName}</p>
            <p className="mt-1 flex flex-wrap gap-1 text-xs">
              <span className="rounded-full bg-surface-muted px-2 py-0.5">
                {copy.gameFormatOption.replaceAll("{n}", String(gameFormat))}
              </span>
              {hasMinors === "ja" && (
                <span className="rounded-full bg-surface-muted px-2 py-0.5">{copy.previewMinors}</span>
              )}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="-mt-1 text-sm text-muted">
          {hint}
        </p>
      )}
      {children}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="text-sm text-danger">
      {children}
    </p>
  );
}
