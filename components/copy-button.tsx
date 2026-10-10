"use client";

import { useState } from "react";

/** Copies `value` to the clipboard and confirms with a short "copied" label. */
export function CopyButton({
  value,
  label,
  copiedLabel,
  className = "",
}: {
  value: string;
  label: string;
  copiedLabel: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked (e.g. insecure context): leave the link for manual copying.
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`min-h-11 rounded-lg border border-border bg-surface px-4 font-medium hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink ${className}`}
    >
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </button>
  );
}
