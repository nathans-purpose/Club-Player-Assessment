import type { ReactNode } from "react";
import { POSITION_COORDS, type PositionCode } from "@/lib/positions";

/**
 * A football pitch, attacking upward. Children are placed with
 * `pitchSpotStyle(code)`; the markings are decorative.
 */
export function Pitch({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="relative mx-auto aspect-[68/100] w-full max-w-sm overflow-visible rounded-xl bg-pitch"
    >
      <svg viewBox="0 0 68 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <g fill="none" stroke="var(--pitch-line)" strokeWidth="0.4">
          <rect x="2" y="2" width="64" height="96" rx="0.5" />
          <line x1="2" y1="50" x2="66" y2="50" />
          <circle cx="34" cy="50" r="8" />
          <rect x="15" y="2" width="38" height="15" />
          <rect x="25" y="2" width="18" height="5.5" />
          <rect x="15" y="83" width="38" height="15" />
          <rect x="25" y="92.5" width="18" height="5.5" />
        </g>
      </svg>
      {children}
    </div>
  );
}

export function pitchSpotStyle(code: PositionCode) {
  const { x, y } = POSITION_COORDS[code];
  return { left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" } as const;
}

/** Background for a position by level 1–3: more lime for a better fit. */
export function levelBackground(level: number | null | undefined): string | undefined {
  if (!level) return undefined;
  const strength = level >= 3 ? 100 : level >= 2 ? 65 : 35;
  return `color-mix(in srgb, var(--scale-high) ${strength}%, var(--surface))`;
}
