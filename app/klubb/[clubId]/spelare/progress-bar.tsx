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
