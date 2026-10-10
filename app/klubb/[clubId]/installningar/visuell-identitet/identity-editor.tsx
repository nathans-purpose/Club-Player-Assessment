"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { contrastRatio, formatRatio, normalizeHex, WHITE } from "@/lib/identity/colors";
import {
  assetUrl,
  ASSETS_BUCKET,
  BRAND_DOCUMENT_ACCEPT,
  BRAND_DOCUMENT_MAX_BYTES,
  BRAND_IMPORT_BUCKET,
  brandDocumentKind,
  brandImagePath,
  FONT_ACCEPT,
  FONT_CONTENT_TYPES,
  FONT_MAX_BYTES,
  type FontExtension,
  fontExtension,
  fontPath,
  LOGO_ACCEPT,
  logoPath,
} from "@/lib/identity/files";
import { logoPng, prepareBrandDocument } from "@/lib/identity/prepare";
import {
  type ColorRole,
  FONT_SLOTS,
  type FontSlot,
  type FontStyle,
  type Identity,
  MAX_COLORS,
  MAX_LOGOS,
  MAX_TONE_WORD_LENGTH,
  MAX_TONE_WORDS,
} from "@/lib/identity/schema";
import type { BrandSuggestion } from "@/lib/identity/suggestion";
import { FONT_FALLBACKS, primaryContrast, themeTokens } from "@/lib/identity/theme";
import { createClient } from "@/lib/supabase/client";
import { supabaseEnv } from "@/lib/supabase/env";
import { readBrandDocument, saveIdentity, stopUsingIdentity } from "./actions";
import type { IdentityCopy } from "./page";

const UNDO_MS = 5000;
const FONT_NAME_PATTERN = /^[\p{L}\p{N} .,&'+-]+$/u;

const inputClass =
  "min-h-11 w-full rounded-lg border border-border bg-surface px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink aria-invalid:border-danger";
const smallButton =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-muted disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary-ink";
const sectionClass = "flex flex-col gap-3 rounded-lg border border-border bg-surface p-4";
// A checkerboard, so a logo's transparent background shows.
const checkerboard = {
  backgroundImage:
    "linear-gradient(45deg,#e6e6e6 25%,transparent 25%),linear-gradient(-45deg,#e6e6e6 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e6e6e6 75%),linear-gradient(-45deg,transparent 75%,#e6e6e6 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
};

type ColorRow = { key: number; hex: string; role: ColorRole; name: string };
/** A logo is either saved (path) or new and still only in the browser (blob). */
type LogoRow = { key: number; path: string | null; blob: Blob | null; url: string; description: string | null };
type FontRow = {
  name: string;
  style: FontStyle;
  file: string | null;
  upload: { blob: Blob; ext: FontExtension; fileName: string } | null;
};
type Draft = { colors: ColorRow[]; logos: LogoRow[]; fonts: Record<FontSlot, FontRow | null>; tone: string };

let nextKey = 1;

function toDraft(identity: Identity | null): Draft {
  return {
    colors: (identity?.colors ?? []).map((c) => ({ key: nextKey++, hex: c.hex, role: c.role, name: c.name ?? "" })),
    logos: (identity?.logos ?? []).map((l) => ({
      key: nextKey++,
      path: l.path,
      blob: null,
      url: savedUrl(l.path),
      description: l.description,
    })),
    fonts: {
      heading: identity?.fonts.heading ? { ...identity.fonts.heading, upload: null } : null,
      body: identity?.fonts.body ? { ...identity.fonts.body, upload: null } : null,
    },
    tone: (identity?.toneWords ?? []).join(", "),
  };
}

function toneWords(tone: string): string[] {
  const words: string[] = [];
  for (const w of tone.split(",").map((s) => s.trim().slice(0, MAX_TONE_WORD_LENGTH))) {
    if (w && !words.some((x) => x.toLowerCase() === w.toLowerCase())) words.push(w);
  }
  return words.slice(0, MAX_TONE_WORDS);
}

const validFontName = (name: string) => FONT_NAME_PATTERN.test(name.trim());

/** The draft as an identity; colours that are not valid hex yet are left out. Paths are filled in on save. */
function toIdentity(draft: Draft): Identity {
  return {
    colors: draft.colors.flatMap((c) => {
      const hex = normalizeHex(c.hex);
      return hex ? [{ hex, role: c.role, name: c.name.trim() || null }] : [];
    }),
    logos: draft.logos.flatMap((l) => (l.path ? [{ path: l.path, description: l.description }] : [])),
    fonts: {
      heading: draft.fonts.heading && validFontName(draft.fonts.heading.name) ? fontOf(draft.fonts.heading) : null,
      body: draft.fonts.body && validFontName(draft.fonts.body.name) ? fontOf(draft.fonts.body) : null,
    },
    toneWords: toneWords(draft.tone),
  };
}

const fontOf = (f: FontRow) => ({ name: f.name.trim(), style: f.style, file: f.file });

export function IdentityEditor({
  clubId,
  clubName,
  initial,
  applied: initialApplied,
  copy,
}: {
  clubId: string;
  clubName: string;
  initial: Identity | null;
  applied: boolean;
  copy: IdentityCopy;
}) {
  const [draft, setDraftState] = useState<Draft>(() => toDraft(initial));
  const [dirty, setDirty] = useState(false);
  const [applied, setApplied] = useState(initialApplied);
  const [hasSaved, setHasSaved] = useState(initial !== null);
  const [undo, setUndo] = useState<{ message: string; action: string; previous: Draft } | null>(null);
  const [tried, setTried] = useState(false);
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "saved" | "stopped" } | { kind: "error"; message: string }>(
    { kind: "idle" },
  );
  const [confirmStop, setConfirmStop] = useState(false);
  const formId = useId();

  function setDraft(update: (d: Draft) => Draft) {
    setDraftState(update);
    setDirty(true);
    if (status.kind !== "saving") setStatus({ kind: "idle" });
  }

  /** Changes that remove something can be undone for a few seconds. */
  function withUndo(message: string, update: (d: Draft) => Draft, action = copy.undo) {
    setUndo({ message, action, previous: draft });
    setDraft(update);
  }

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  const identity = useMemo(() => toIdentity(draft), [draft]);
  const colorErrors = draft.colors.map((c) => !normalizeHex(c.hex));
  const fontErrors = FONT_SLOTS.map((s) => Boolean(draft.fonts[s] && !validFontName(draft.fonts[s]!.name)));

  async function save() {
    setTried(true);
    if (colorErrors.some(Boolean) || fontErrors.some(Boolean)) {
      setStatus({ kind: "error", message: copy.fixErrors });
      // After React has marked the fields, move to the first one.
      setTimeout(() => document.querySelector<HTMLElement>(`#${CSS.escape(formId)} [aria-invalid="true"]`)?.focus());
      return;
    }
    setStatus({ kind: "saving" });
    try {
      const bucket = createClient().storage.from(ASSETS_BUCKET);
      const logos: LogoRow[] = [];
      for (const logo of draft.logos) {
        if (logo.path || !logo.blob) {
          logos.push(logo);
          continue;
        }
        const path = logoPath(clubId, crypto.randomUUID());
        const { error } = await bucket.upload(path, logo.blob, { contentType: "image/png" });
        if (error) throw error;
        logos.push({ ...logo, path, blob: null });
      }
      const fonts = { ...draft.fonts };
      for (const slot of FONT_SLOTS) {
        const font = fonts[slot];
        if (!font?.upload) continue;
        const path = fontPath(clubId, crypto.randomUUID(), font.upload.ext);
        const { error } = await bucket.upload(path, font.upload.blob, {
          contentType: FONT_CONTENT_TYPES[font.upload.ext],
        });
        if (error) throw error;
        fonts[slot] = { ...font, file: path, upload: null };
      }
      const uploaded: Draft = { ...draft, logos, fonts };
      const result = await saveIdentity(clubId, toIdentity(uploaded));
      // Uploaded files keep their paths either way, so a retry does not upload them again.
      setDraftState(uploaded);
      if (result.status === "error") return setStatus({ kind: "error", message: result.message });
      setDirty(false);
      setApplied(true);
      setHasSaved(true);
      setUndo(null);
      setStatus({ kind: "saved" });
    } catch {
      setStatus({ kind: "error", message: copy.saveFailed });
    }
  }

  async function stop() {
    setConfirmStop(false);
    setStatus({ kind: "saving" });
    const result = await stopUsingIdentity(clubId).catch(() => null);
    if (!result || result.status === "error") {
      return setStatus({ kind: "error", message: result?.message ?? copy.saveFailed });
    }
    setApplied(false);
    setStatus({ kind: "stopped" });
  }

  function applySuggestion(suggestion: BrandSuggestion, logos: { blob: Blob; description: string | null }[], file: string) {
    withUndo(
      copy.importDone.replace("{file}", file),
      (d) => ({
        colors: suggestion.colors.length
          ? suggestion.colors.map((c) => ({ key: nextKey++, hex: c.hex, role: c.role, name: c.name ?? "" }))
          : d.colors,
        logos: logos.length
          ? logos.map((l) => ({
              key: nextKey++,
              path: null,
              blob: l.blob,
              url: URL.createObjectURL(l.blob),
              description: l.description,
            }))
          : d.logos,
        fonts: {
          heading: suggestion.fonts.heading ? { ...suggestion.fonts.heading, file: null, upload: null } : d.fonts.heading,
          body: suggestion.fonts.body ? { ...suggestion.fonts.body, file: null, upload: null } : d.fonts.body,
        },
        tone: suggestion.toneWords.length ? suggestion.toneWords.join(", ") : d.tone,
      }),
      copy.undoImport,
    );
  }

  const saving = status.kind === "saving";

  return (
    <div id={formId} className="flex flex-col gap-6 pb-4">
      <BrandImport clubId={clubId} copy={copy} onSuggestion={applySuggestion} />

      <ColorsSection draft={draft} setDraft={setDraft} withUndo={withUndo} errors={colorErrors} tried={tried} copy={copy} />
      <ContrastCheck identity={identity} copy={copy} />
      <LogosSection draft={draft} setDraft={setDraft} withUndo={withUndo} copy={copy} />
      <FontsSection draft={draft} setDraft={setDraft} errors={fontErrors} tried={tried} copy={copy} />

      <section aria-labelledby="tone-title" className={sectionClass}>
        <h2 id="tone-title" className="text-lg font-semibold">
          {copy.tone}
        </h2>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{copy.toneLabel}</span>
          <input
            className={inputClass}
            value={draft.tone}
            onChange={(e) => setDraft((d) => ({ ...d, tone: e.target.value }))}
            aria-describedby="tone-hint"
          />
        </label>
        <p id="tone-hint" className="text-sm text-muted">
          {copy.toneHint}
        </p>
      </section>

      <Preview identity={identity} draft={draft} clubName={clubName} copy={copy} />

      {undo && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-muted p-3 text-sm"
        >
          {undo.message}
          <button
            type="button"
            onClick={() => {
              setDraftState(undo.previous);
              setUndo(null);
            }}
            className="min-h-11 px-2 font-semibold underline"
          >
            {undo.action}
          </button>
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-border bg-background/95 px-4 py-3">
        {hasSaved && !applied && status.kind !== "stopped" && <p className="text-sm">{copy.notApplied}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-on-primary hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink"
          >
            {saving ? copy.saving : copy.save}
          </button>
          <p role="status" className="text-sm">
            {status.kind === "saved" && copy.saved}
            {status.kind === "stopped" && copy.stopped}
            {status.kind === "idle" && dirty && copy.unsaved}
          </p>
          {applied && !confirmStop && (
            <button type="button" onClick={() => setConfirmStop(true)} disabled={saving} className={`${smallButton} sm:ml-auto`}>
              {copy.stop}
            </button>
          )}
        </div>
        {confirmStop && (
          <div role="alertdialog" aria-labelledby="stop-confirm" className="rounded-lg border border-border bg-surface p-3">
            <p id="stop-confirm" className="text-sm">
              {copy.stopConfirm}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={stop} className={smallButton} autoFocus>
                {copy.stopYes}
              </button>
              <button type="button" onClick={() => setConfirmStop(false)} className={smallButton}>
                {copy.cancel}
              </button>
            </div>
          </div>
        )}
        {status.kind === "error" && (
          <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
            {status.message}
          </p>
        )}
      </div>
    </div>
  );
}

type SectionProps = {
  draft: Draft;
  setDraft: (update: (d: Draft) => Draft) => void;
  copy: IdentityCopy;
};

function BrandImport({
  clubId,
  copy,
  onSuggestion,
}: {
  clubId: string;
  copy: IdentityCopy;
  onSuggestion: (s: BrandSuggestion, logos: { blob: Blob; description: string | null }[], file: string) => void;
}) {
  const [state, setState] = useState<
    { status: "idle" } | { status: "reading"; file: string } | { status: "error"; message: string }
  >({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const reading = state.status === "reading";

  // A file chosen before the page finished loading never reached React's
  // change handler; send the change again once the component is ready.
  useEffect(() => {
    const input = inputRef.current;
    if (input?.files?.length) input.dispatchEvent(new Event("change", { bubbles: true }));
  }, []);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const kind = brandDocumentKind(file.name, file.type);
    if (!kind) return setState({ status: "error", message: copy.importWrongType });
    if (file.size > BRAND_DOCUMENT_MAX_BYTES) return setState({ status: "error", message: copy.importTooBig });

    setState({ status: "reading", file: file.name });
    const prepared = await prepareBrandDocument(file, kind).catch((error) => {
      console.error("Could not prepare the brand document", error);
      return null;
    });
    if (!prepared) return setState({ status: "error", message: copy.importUnreadable });

    const batchId = crypto.randomUUID();
    const bucket = createClient().storage.from(BRAND_IMPORT_BUCKET);
    const paths: string[] = [];
    for (const [i, image] of prepared.images.entries()) {
      const path = brandImagePath(clubId, batchId, i, image.contentType);
      const { error } = await bucket.upload(path, image.blob, { contentType: image.contentType });
      if (error) {
        if (paths.length) await bucket.remove(paths);
        return setState({ status: "error", message: copy.importUploadFailed });
      }
      paths.push(path);
    }

    const result = await readBrandDocument(clubId, batchId, paths, prepared.hints).catch(() => null);
    if (!result) return setState({ status: "error", message: copy.importUploadFailed });
    if (result.status === "error") return setState({ status: "error", message: result.message });

    const logos: { blob: Blob; description: string | null }[] = [];
    for (const box of result.suggestion.logos) {
      const blob = await logoPng(prepared.images[box.image].blob, box).catch(() => null);
      if (blob) logos.push({ blob, description: box.description });
    }
    onSuggestion(result.suggestion, logos, file.name);
    setState({ status: "idle" });
  }

  return (
    <section aria-labelledby="import-title" className={sectionClass}>
      <h2 id="import-title" className="text-lg font-semibold">
        {copy.importTitle}
      </h2>
      <p id="import-hint" className="text-sm text-muted">
        {copy.importHint}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={BRAND_DOCUMENT_ACCEPT}
        onChange={onChange}
        disabled={reading}
        aria-label={copy.importChoose}
        className="sr-only"
        tabIndex={-1}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={reading}
          aria-describedby="import-hint"
          className={smallButton}
        >
          {copy.importChoose}
        </button>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {state.status === "reading" && (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-border border-t-primary" />
              {copy.importReading.replace("{file}", state.file)}
            </span>
          )}
        </p>
      </div>
      {state.status === "error" && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
          {state.message}
        </p>
      )}
    </section>
  );
}

function ColorsSection({
  draft,
  setDraft,
  withUndo,
  errors,
  tried,
  copy,
}: SectionProps & {
  withUndo: (message: string, update: (d: Draft) => Draft) => void;
  errors: boolean[];
  tried: boolean;
}) {
  const roles: [ColorRole, string][] = [
    ["primary", copy.rolePrimary],
    ["secondary", copy.roleSecondary],
    ["other", copy.roleOther],
  ];

  function update(key: number, change: Partial<ColorRow>) {
    setDraft((d) => ({
      ...d,
      colors: d.colors.map((c) => {
        if (c.key === key) return { ...c, ...change };
        // Only one main and one complementary colour: the previous one becomes "other".
        if (change.role && change.role !== "other" && c.role === change.role) return { ...c, role: "other" };
        return c;
      }),
    }));
  }

  return (
    <section aria-labelledby="colors-title" className={sectionClass}>
      <h2 id="colors-title" className="text-lg font-semibold">
        {copy.colors}
      </h2>
      <p className="text-sm text-muted">{copy.colorsHint}</p>
      {draft.colors.length > 0 && !draft.colors.some((c) => c.role === "primary") && (
        <p className="text-sm">{copy.noPrimary}</p>
      )}
      <ul aria-label={copy.colorList} className="flex flex-col gap-3">
        {draft.colors.map((c, i) => {
          const n = String(i + 1);
          const hex = normalizeHex(c.hex);
          const invalid = errors[i] && (tried || c.hex.length >= 4);
          return (
            <li key={c.key} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[auto_1fr_1fr_1fr_auto] sm:items-end">
              <input
                type="color"
                value={(hex ?? "#000000").toLowerCase()}
                onChange={(e) => update(c.key, { hex: e.target.value.toUpperCase() })}
                aria-label={copy.colorPicker.replace("{n}", n)}
                className="h-11 w-16 cursor-pointer rounded-lg border border-border bg-surface p-1"
              />
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">{copy.colorHex}</span>
                <input
                  className={`${inputClass} font-mono`}
                  value={c.hex}
                  onChange={(e) => update(c.key, { hex: e.target.value })}
                  onBlur={() => hex && update(c.key, { hex })}
                  aria-invalid={invalid || undefined}
                  aria-describedby={invalid ? `color-error-${c.key}` : undefined}
                  spellCheck={false}
                />
                {invalid && (
                  <span id={`color-error-${c.key}`} className="text-sm text-danger">
                    {copy.colorHexInvalid}
                  </span>
                )}
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">{copy.colorRole}</span>
                <select
                  className={inputClass}
                  value={c.role}
                  onChange={(e) => update(c.key, { role: e.target.value as ColorRole })}
                >
                  {roles.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">{copy.colorName}</span>
                <input className={inputClass} value={c.name} maxLength={40} onChange={(e) => update(c.key, { name: e.target.value })} />
              </label>
              <button
                type="button"
                className={smallButton}
                aria-label={copy.removeColor.replace("{n}", n)}
                onClick={() =>
                  withUndo(copy.removed.replace("{name}", hex ?? c.hex), (d) => ({
                    ...d,
                    colors: d.colors.filter((x) => x.key !== c.key),
                  }))
                }
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
      <div>
        <button
          type="button"
          className={smallButton}
          disabled={draft.colors.length >= MAX_COLORS}
          onClick={() =>
            setDraft((d) => ({
              ...d,
              colors: [
                ...d.colors,
                {
                  key: nextKey++,
                  hex: d.colors.length ? "#000000" : "#1F5C3A",
                  role: d.colors.some((c) => c.role === "primary") ? "other" : "primary",
                  name: "",
                },
              ],
            }))
          }
        >
          {copy.addColor}
        </button>
      </div>
    </section>
  );
}

function ContrastCheck({ identity, copy }: { identity: Identity; copy: IdentityCopy }) {
  const contrast = primaryContrast(identity);
  if (!contrast) return null;
  const ratio = formatRatio(contrastRatio(contrast.primary, WHITE));
  return (
    <section
      aria-labelledby="contrast-title"
      className={`flex flex-col gap-2 rounded-lg border p-4 ${contrast.adjusted ? "border-scale-mid bg-scale-mid/10" : "border-border bg-surface"}`}
    >
      <h2 id="contrast-title" className="font-semibold">
        {copy.contrastTitle}
      </h2>
      <p className="text-sm">
        {(contrast.adjusted ? copy.contrastLow : copy.contrastOk)
          .replace("{color}", contrast.primary)
          .replace("{ratio}", ratio)
          .replace("{ink}", contrast.ink)
          .replace("{inkRatio}", formatRatio(contrastRatio(contrast.ink, WHITE)))}{" "}
        {contrast.onPrimary === WHITE ? copy.contrastButtonLight : copy.contrastButtonDark}
      </p>
      <div className="flex flex-wrap items-center gap-3 text-sm" aria-hidden="true">
        <span className="inline-flex min-h-11 items-center rounded-lg px-4 font-semibold" style={{ background: contrast.primary, color: contrast.onPrimary }}>
          {copy.previewButton}
        </span>
        <span className="font-semibold underline" style={{ color: contrast.ink }}>
          {copy.previewLink}
        </span>
        {contrast.adjusted && (
          <span className="inline-flex items-center gap-2">
            <span className="size-6 rounded border border-border" style={{ background: contrast.primary }} />→
            <span className="size-6 rounded border border-border" style={{ background: contrast.ink }} />
            <span className="font-mono">{contrast.ink}</span>
          </span>
        )}
      </div>
    </section>
  );
}

function LogosSection({
  draft,
  setDraft,
  withUndo,
  copy,
}: SectionProps & { withUndo: (message: string, update: (d: Draft) => Draft) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // A file chosen before the page finished loading never reached React's
  // change handler; send the change again once the component is ready.
  useEffect(() => {
    const input = inputRef.current;
    if (input?.files?.length) input.dispatchEvent(new Event("change", { bubbles: true }));
  }, []);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    const blob = await logoPng(file).catch(() => null);
    if (!blob) return setError(copy.logoFailed);
    setDraft((d) => ({
      ...d,
      logos: [...d.logos, { key: nextKey++, path: null, blob, url: URL.createObjectURL(blob), description: null }],
    }));
  }

  return (
    <section aria-labelledby="logos-title" className={sectionClass}>
      <h2 id="logos-title" className="text-lg font-semibold">
        {copy.logos}
      </h2>
      <p className="text-sm text-muted">{copy.logosHint}</p>
      {draft.logos.length === 0 ? (
        <p className="text-sm">{copy.noLogos}</p>
      ) : (
        <ul aria-label={copy.logoList} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {draft.logos.map((logo, i) => {
            const n = String(i + 1);
            return (
              <li key={logo.key} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex h-28 items-center justify-center rounded" style={checkerboard}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- a local or Storage image of any size */}
                  <img src={logo.url} alt={logo.description ?? copy.logoAlt.replace("{n}", n)} className="max-h-24 max-w-full object-contain" />
                </div>
                <p className="text-sm">
                  {i === 0 && <span className="mr-2 rounded bg-primary/15 px-2 py-0.5 font-semibold">{copy.mainLogo}</span>}
                  {logo.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {i > 0 && (
                    <button
                      type="button"
                      className={smallButton}
                      aria-label={copy.makeMainLabel.replace("{n}", n)}
                      onClick={() =>
                        setDraft((d) => ({ ...d, logos: [logo, ...d.logos.filter((l) => l.key !== logo.key)] }))
                      }
                    >
                      {copy.makeMain}
                    </button>
                  )}
                  <button
                    type="button"
                    className={smallButton}
                    aria-label={copy.removeLogo.replace("{n}", n)}
                    onClick={() =>
                      withUndo(copy.removed.replace("{name}", logo.description ?? copy.logoAlt.replace("{n}", n)), (d) => ({
                        ...d,
                        logos: d.logos.filter((l) => l.key !== logo.key),
                      }))
                    }
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={LOGO_ACCEPT}
        onChange={onChange}
        aria-label={copy.addLogo}
        className="sr-only"
        tabIndex={-1}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={smallButton}
          disabled={draft.logos.length >= MAX_LOGOS}
          onClick={() => inputRef.current?.click()}
          aria-describedby="logo-hint"
        >
          {copy.addLogo}
        </button>
        <span id="logo-hint" className="text-sm text-muted">
          {copy.addLogoHint}
        </span>
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
          {error}
        </p>
      )}
    </section>
  );
}

function FontsSection({ draft, setDraft, errors, tried, copy }: SectionProps & { errors: boolean[]; tried: boolean }) {
  const slotLabel: Record<FontSlot, string> = { heading: copy.fontHeading, body: copy.fontBody };
  const styles: [FontStyle, string][] = [
    ["sans", copy.styleSans],
    ["serif", copy.styleSerif],
    ["condensed", copy.styleCondensed],
    ["extended", copy.styleExtended],
  ];
  return (
    <section aria-labelledby="fonts-title" className={sectionClass}>
      <h2 id="fonts-title" className="text-lg font-semibold">
        {copy.fonts}
      </h2>
      <p className="text-sm text-muted">{copy.fontsHint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {FONT_SLOTS.map((slot, i) => (
          <FontEditor
            key={slot}
            label={slotLabel[slot]}
            font={draft.fonts[slot]}
            invalid={errors[i] && (tried || Boolean(draft.fonts[slot]?.name))}
            styles={styles}
            onChange={(font) => setDraft((d) => ({ ...d, fonts: { ...d.fonts, [slot]: font } }))}
            copy={copy}
          />
        ))}
      </div>
    </section>
  );
}

function FontEditor({
  label,
  font,
  invalid,
  styles,
  onChange,
  copy,
}: {
  label: string;
  font: FontRow | null;
  invalid: boolean;
  styles: [FontStyle, string][];
  onChange: (font: FontRow | null) => void;
  copy: IdentityCopy;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const slot = label.toLowerCase();

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !font) return;
    if (file.size > FONT_MAX_BYTES) return setError(copy.fontTooBig);
    const ext = fontExtension(file.name, new Uint8Array(await file.slice(0, 4).arrayBuffer()));
    if (!ext) return setError(copy.fontWrongType);
    setError(null);
    onChange({ ...font, upload: { blob: file, ext, fileName: file.name } });
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <legend className="px-1 font-semibold">{label}</legend>
      {!font ? (
        <button
          type="button"
          className={smallButton}
          onClick={() => onChange({ name: "", style: "sans", file: null, upload: null })}
        >
          {copy.fontAdd.replace("{slot}", slot)}
        </button>
      ) : (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{copy.fontName}</span>
            <input
              className={inputClass}
              value={font.name}
              maxLength={60}
              onChange={(e) => onChange({ ...font, name: e.target.value })}
              aria-invalid={invalid || undefined}
              aria-describedby={invalid ? `${id}-error` : undefined}
            />
            {invalid && (
              <span id={`${id}-error`} className="text-sm text-danger">
                {copy.fontNameInvalid}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{copy.fontStyle}</span>
            <select
              className={inputClass}
              value={font.style}
              onChange={(e) => onChange({ ...font, style: e.target.value as FontStyle })}
            >
              {styles.map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-muted" role="status">
            {font.upload
              ? copy.fontPending.replace("{file}", font.upload.fileName)
              : font.file
                ? copy.fontUploaded
                : copy.fontFallback.replace("{fallback}", FONT_FALLBACKS[font.style].label)}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={FONT_ACCEPT}
            onChange={onFile}
            aria-label={copy.fontUpload.replace("{slot}", slot)}
            className="sr-only"
            tabIndex={-1}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={smallButton} onClick={() => inputRef.current?.click()}>
              {(font.file || font.upload ? copy.fontReplace : copy.fontUpload).replace("{slot}", slot)}
            </button>
            {(font.file || font.upload) && (
              <button type="button" className={smallButton} onClick={() => onChange({ ...font, file: null, upload: null })}>
                {copy.fontRemoveFile.replace("{slot}", slot)}
              </button>
            )}
            <button type="button" className={smallButton} onClick={() => onChange(null)}>
              {copy.fontRemove.replace("{slot}", slot)}
            </button>
          </div>
          {error && (
            <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
              {error}
            </p>
          )}
        </>
      )}
    </fieldset>
  );
}

/** Loads a club font for the preview only, under its own family name. */
function usePreviewFont(slot: FontSlot, font: FontRow | null): string | null {
  const [loaded, setLoaded] = useState<{ source: Blob | string; family: string } | null>(null);
  const source = font?.upload?.blob ?? (font?.file ? savedUrl(font.file) : null);
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    const family = `Preview ${slot} ${nextKey++}`;
    (async () => {
      const face = new FontFace(family, typeof source === "string" ? `url("${source}")` : await source.arrayBuffer());
      await face.load();
      if (cancelled) return;
      document.fonts.add(face);
      setLoaded({ source, family });
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slot, source]);
  return loaded && loaded.source === source ? loaded.family : null;
}

function Preview({
  identity,
  draft,
  clubName,
  copy,
}: {
  identity: Identity;
  draft: Draft;
  clubName: string;
  copy: IdentityCopy;
}) {
  const [mode, setMode] = useState<"club" | "default">("club");
  const headingFamily = usePreviewFont("heading", draft.fonts.heading);
  const bodyFamily = usePreviewFont("body", draft.fonts.body);

  const style = useMemo(() => {
    if (mode === "default") return {};
    const { vars } = themeTokens({ ...identity, fonts: { heading: noFile(identity.fonts.heading), body: noFile(identity.fonts.body) } }, () => null);
    if (headingFamily) {
      vars["--font-heading"] = `"${headingFamily}", ${vars["--font-heading"]}`;
      vars["--heading-stretch"] = "normal";
    }
    if (bodyFamily) {
      vars["--font-body"] = `"${bodyFamily}", ${vars["--font-body"]}`;
      vars["--body-stretch"] = "normal";
    }
    return vars as React.CSSProperties;
  }, [mode, identity, headingFamily, bodyFamily]);

  const logo = mode === "club" ? draft.logos[0] : undefined;

  return (
    <section aria-labelledby="preview-title" className={sectionClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="preview-title" className="text-lg font-semibold">
          {copy.preview}
        </h2>
        <div role="group" aria-label={copy.previewToggle} className="flex rounded-lg border border-border p-1">
          {(
            [
              ["club", copy.previewClub],
              ["default", copy.previewDefault],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={`min-h-11 rounded-md px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary-ink ${
                mode === value ? "bg-surface-muted" : ""
              }`}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
      <div
        data-testid="identity-preview"
        style={{ ...style, fontFamily: "var(--font-body)", fontStretch: "var(--body-stretch)" }}
        className="overflow-hidden rounded-lg border border-border bg-background"
      >
        <div className="flex items-center gap-3 border-t-4 border-b border-t-brand-stripe border-b-border bg-surface px-4 py-2">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element -- a local or Storage image of any size
            <img src={logo.url} alt="" className="h-9 w-auto max-w-32 object-contain" />
          )}
          <span className="font-semibold">{clubName}</span>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <h3 className="text-2xl font-bold">{copy.previewHeading}</h3>
          <p>{copy.previewBody}</p>
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-on-primary">
              {copy.previewButton}
            </span>
            <span className="font-medium text-primary-ink underline">{copy.previewLink}</span>
          </div>
          <div className="flex gap-1" aria-hidden="true">
            {["bg-scale-low", "bg-scale-mid", "bg-scale-high"].map((c) => (
              <span key={c} className={`h-3 w-10 rounded ${c}`} />
            ))}
          </div>
          <p className="text-sm text-muted">{copy.previewCaption}</p>
          {mode === "club" && identity.toneWords.length > 0 && (
            <p className="text-sm">
              <span className="font-medium">{copy.tone}:</span> {identity.toneWords.join(", ")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

const noFile = (f: Identity["fonts"]["heading"]) => (f ? { ...f, file: null } : null);

/** Public URL of a saved logo or font file. */
const savedUrl = (path: string) => assetUrl(supabaseEnv().url, path);
