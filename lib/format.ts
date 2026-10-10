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
