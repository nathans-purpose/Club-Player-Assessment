/**
 * All UI copy goes through `t(key, fallback)` so a club's text overrides
 * ("Redigera texter", stored in ui_text_overrides) can replace any string.
 * Until overrides are wired up, the Swedish fallback is returned as is.
 */
export function t(key: string, fallback: string, overrides?: Record<string, string>): string {
  return overrides?.[key] ?? fallback;
}
