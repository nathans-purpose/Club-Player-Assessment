import { t } from "@/lib/i18n";

/** "X av N spelare bedömda", plus how many the leader skipped. */
export function progressLabel(progress: { done: number; total: number; skipped: number }): string {
  const label = t("players.progress", "{done} av {total} spelare bedömda")
    .replace("{done}", String(progress.done))
    .replace("{total}", String(progress.total));
  if (progress.skipped === 0) return label;
  const skipped =
    progress.skipped === 1
      ? t("players.progressSkippedOne", "(1 överhoppad)")
      : t("players.progressSkipped", "({count} överhoppade)").replace("{count}", String(progress.skipped));
  return `${label} ${skipped}`;
}

/** "X av N spelare bedömda" with a bar. The text carries the meaning. */
export function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium">{label}</p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="h-2 overflow-hidden rounded-full bg-surface-muted"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}
