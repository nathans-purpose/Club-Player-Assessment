// Swedish number formatting: decimal comma, full words in the UI.

const decimal = new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });

/** 7.25 → "7,3"; null → "–". */
export function formatScore(value: number | null): string {
  return value === null ? "–" : decimal.format(value);
}

/** 79.6 → "80 %"; null → "–". */
export function formatPercent(value: number | null): string {
  return value === null ? "–" : `${whole.format(value)} %`;
}

const rate = new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 0.654 → "0,65 per match"; null → "–". Full words, never "/m". */
export function formatRate(value: number | null): string {
  return value === null ? "–" : `${rate.format(value)} per match`;
}

/** 0.654 → "0,65"; for table cells where the column header names the unit. */
export function formatRateShort(value: number | null): string {
  return value === null ? "–" : rate.format(value);
}

/** 12 → "12"; null → "–". */
export function formatCount(value: number | null): string {
  return value === null ? "–" : whole.format(value);
}

const date = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Stockholm",
});

/** "2026-10-10T08:00:00Z" → "10 oktober 2026" (Swedish time). */
export function formatDate(value: string | Date): string {
  return date.format(typeof value === "string" ? new Date(value) : value);
}
