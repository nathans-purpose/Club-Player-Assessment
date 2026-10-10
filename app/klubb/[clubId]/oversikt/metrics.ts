import { attributeT, isLowAttendance, scaleColor } from "@/lib/calc";
import { formatCount, formatPercent, formatRate, formatRateShort, formatScore } from "@/lib/format";
import type { MetricKey, Overview } from "@/lib/overview";
import type { OverviewCopy } from "./copy";

export type MetricKind = "score" | "percent" | "count" | "rate";

export function metricKind(metric: MetricKey): MetricKind {
  if (metric === "total" || metric.startsWith("category:")) return "score";
  if (metric === "attendance" || metric.startsWith("phase:")) return "percent";
  if (metric.endsWith("PerMatch")) return "rate";
  return "count";
}

export function metricLabel(metric: MetricKey, copy: OverviewCopy, overview: Pick<Overview, "categories" | "phases">) {
  if (metric.startsWith("category:")) {
    return overview.categories.find((c) => `category:${c.id}` === metric)?.name ?? "";
  }
  if (metric.startsWith("phase:")) {
    const phase = overview.phases.find((p) => `phase:${p.id}` === metric);
    return copy.metric.phase.replace("{phase}", phase?.name ?? "");
  }
  return copy.metric[metric as keyof OverviewCopy["metric"]];
}

/** Full words for rates ("0,65 per match"); `short` drops the unit for table cells. */
export function formatMetric(metric: MetricKey, value: number | null, short = false): string {
  switch (metricKind(metric)) {
    case "score":
      return formatScore(value);
    case "percent":
      return formatPercent(value);
    case "rate":
      return short ? formatRateShort(value) : formatRate(value);
    default:
      return formatCount(value);
  }
}

/**
 * Heat colour behind a value: scores on the red → lime scale, low attendance
 * in the warning colour. Counts and rates get none.
 */
export function heatBackground(metric: MetricKey, value: number | null): string | undefined {
  if (value === null) return undefined;
  const kind = metricKind(metric);
  if (kind === "score") return `color-mix(in srgb, ${scaleColor(attributeT(value))} 40%, var(--surface))`;
  if (kind === "percent" && isLowAttendance(value)) return "color-mix(in srgb, var(--danger) 18%, var(--surface))";
  return undefined;
}
