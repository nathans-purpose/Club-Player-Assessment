import { cache } from "react";

/**
 * All UI copy goes through `t(key, fallback)` so a club's text overrides
 * ("Redigera texter", stored in ui_text_overrides) can replace any string.
 *
 * Overrides are request-scoped: loading a club (lib/assessment/data.ts) puts
 * its overrides in a per-request store, and every `t()` call after that in the
 * same server render uses them. Outside a server request (tests, client code)
 * the store is empty and the Swedish fallback is returned.
 */
const requestTexts = cache((): { overrides?: Record<string, string> } => ({}));

export function setRequestTexts(overrides: Record<string, string>) {
  requestTexts().overrides = overrides;
}

export function t(key: string, fallback: string, overrides?: Record<string, string>): string {
  const value = (overrides ?? requestTexts().overrides)?.[key];
  return value?.trim() ? value : fallback;
}

/** A text an admin can edit in place: its key, current value and default. */
export type EditableCopy = { textKey: string; value: string; fallback: string };

/** Like `t()`, but keeps the key and default so the text can be edited in place. */
export function te(key: string, fallback: string, overrides?: Record<string, string>): EditableCopy {
  return { textKey: key, value: t(key, fallback, overrides), fallback };
}

/** Longest text an override may have; longer ones are refused when saved. */
export const MAX_TEXT_LENGTH = 2000;

/** Text keys are dotted identifiers like `overview.pitch.hint`. */
export function isTextKey(key: string): boolean {
  return /^[a-zA-Z][\w-]*(\.[\w-]+)*$/.test(key) && key.length <= 120;
}

export type TextChange = { key: string; value: string; fallback: string };

/**
 * Splits edited texts into overrides to store and keys to clear: a text that
 * is empty or equal to its default goes back to the default.
 */
export function planTextChanges(changes: TextChange[]): {
  upsert: { key: string; value: string }[];
  remove: string[];
  invalid: string[];
} {
  const upsert: { key: string; value: string }[] = [];
  const remove: string[] = [];
  const invalid: string[] = [];
  for (const change of changes) {
    const value = change.value.trim();
    if (!isTextKey(change.key) || value.length > MAX_TEXT_LENGTH) invalid.push(change.key);
    else if (!value || value === change.fallback.trim()) remove.push(change.key);
    else upsert.push({ key: change.key, value });
  }
  return { upsert, remove, invalid };
}
