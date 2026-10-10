"use client";

import { useId, useRef, useState } from "react";
import { IMPORT_ACCEPT, IMPORT_BUCKET, IMPORT_MAX_BYTES, importPath } from "@/lib/players/import/files";
import { prepareUpload } from "@/lib/players/import/prepare";
import type { ImportedRow } from "@/lib/players/import/schema";
import { createClient } from "@/lib/supabase/client";
import { readPlayerFile } from "./import-action";

export type FileImportCopy = Record<
  "title" | "hint" | "choose" | "chooseMore" | "reading" | "added" | "wrongType" | "tooBig" | "uploadFailed",
  string
>;

type State =
  | { status: "idle" }
  | { status: "reading"; fileName: string }
  | { status: "done"; message: string }
  | { status: "error"; message: string };

/**
 * Upload of a squad list (photo, PDF, Excel, CSV or Word). The file goes
 * straight from the browser to a private Storage bucket, the server reads it
 * with Claude and deletes it, and the players are appended to the review table.
 */
export function FileImport({
  clubId,
  hasImported,
  onRows,
  copy,
}: {
  clubId: string;
  hasImported: boolean;
  onRows: (rows: ImportedRow[]) => void;
  copy: FileImportCopy;
}) {
  const [state, setState] = useState<State>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const reading = state.status === "reading";

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > IMPORT_MAX_BYTES) return setState({ status: "error", message: copy.tooBig });

    setState({ status: "reading", fileName: file.name });
    const prepared = await prepareUpload(file).catch(() => null);
    if (!prepared) return setState({ status: "error", message: copy.wrongType });

    const path = importPath(clubId, crypto.randomUUID(), prepared.contentType);
    const { error } = await createClient()
      .storage.from(IMPORT_BUCKET)
      .upload(path, prepared.body, { contentType: prepared.contentType });
    if (error) return setState({ status: "error", message: copy.uploadFailed });

    const result = await readPlayerFile(clubId, path).catch(() => null);
    if (!result) return setState({ status: "error", message: copy.uploadFailed });
    if (result.status === "error") return setState({ status: "error", message: result.message });

    onRows(result.rows);
    setState({
      status: "done",
      message: copy.added.replace("{count}", String(result.rows.length)).replace("{file}", file.name),
    });
  }

  return (
    <section aria-labelledby="upload-title" className="rounded-xl border border-border bg-surface p-4">
      <h2 id="upload-title" className="font-semibold">
        {copy.title}
      </h2>
      <p id="upload-hint" className="mt-1 text-sm text-muted">
        {copy.hint}
      </p>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={IMPORT_ACCEPT}
        onChange={onChange}
        disabled={reading}
        aria-label={copy.choose}
        className="sr-only"
        tabIndex={-1}
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={reading}
          aria-describedby="upload-hint"
          className="min-h-11 rounded-lg border border-border bg-surface px-4 font-medium hover:bg-surface-muted disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink"
        >
          {hasImported ? copy.chooseMore : copy.choose}
        </button>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {state.status === "reading" && (
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-4 animate-spin rounded-full border-2 border-border border-t-primary"
              />
              {copy.reading.replace("{file}", state.fileName)}
            </span>
          )}
          {state.status === "done" && state.message}
        </p>
      </div>
      {state.status === "error" && (
        <p role="alert" className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
          {state.message}
        </p>
      )}
    </section>
  );
}
