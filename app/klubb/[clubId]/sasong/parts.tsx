import type { ReactNode } from "react";
import { attributeT, scaleColor } from "@/lib/calc";
import { formatScore } from "@/lib/format";

// Small display pieces shared by Säsong's overview and summary.

export function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <span className="block text-sm text-muted">{label}</span>
      <span className="text-2xl font-bold">{children}</span>
    </div>
  );
}

/** A 1–10 average with its colour; the number is always shown. */
export function Score({ value }: { value: number | null }) {
  return (
    <span className="inline-flex items-center gap-2">
      {value !== null && (
        <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ background: scaleColor(attributeT(value)) }} />
      )}
      <span className="font-semibold">{formatScore(value)}</span>
    </span>
  );
}
