// Bedömningskategorier: checks for the admin's edits and the load summary
// (how many ratings each player gets and roughly how long that takes).

export type EditableSubcategory = { id: string | null; name: string };
export type EditableCategory = {
  id: string | null;
  name: string;
  question: string;
  subcategories: EditableSubcategory[];
};

export const MAX_CATEGORIES = 12;
export const MAX_SUBCATEGORIES = 8;
export const MAX_NAME_LENGTH = 40;
export const MAX_QUESTION_LENGTH = 200;

/** Above this many ratings per player the summary warns that it gets long. */
export const RATINGS_WARNING_ABOVE = 16;

// Rough timing for the estimate: each rating, plus positions, attendance and
// a short comment per player.
export const SECONDS_PER_RATING = 10;
export const SECONDS_PER_PLAYER_EXTRA = 40;

/** Each category is one rating, or one per subcategory when it is deepened. */
export function ratingsPerPlayer(categories: readonly Pick<EditableCategory, "subcategories">[]): number {
  return categories.reduce((sum, c) => sum + Math.max(1, c.subcategories.length), 0);
}

/** Estimated minutes for one leader to assess one player and the whole squad. */
export function estimatedMinutes(ratings: number, playerCount: number): { perPlayer: number; squad: number } {
  const seconds = ratings * SECONDS_PER_RATING + SECONDS_PER_PLAYER_EXTRA;
  return {
    perPlayer: Math.max(1, Math.round(seconds / 60)),
    squad: Math.round((seconds * playerCount) / 60),
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function cleanId(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

export type CategoriesResult = { ok: true; categories: EditableCategory[] } | { ok: false; message: string };

/**
 * Cleans and checks the categories an admin wants to save. Messages are shown
 * to the admin as they are.
 */
export function validateCategories(input: unknown): CategoriesResult {
  if (!Array.isArray(input)) return { ok: false, message: "Kategorierna kunde inte läsas. Försök igen." };

  const categories: EditableCategory[] = input.map((c) => ({
    id: cleanId(c?.id),
    name: cleanText(c?.name),
    question: cleanText(c?.question),
    subcategories: Array.isArray(c?.subcategories)
      ? c.subcategories.map((s: unknown) => ({
          id: cleanId((s as { id?: unknown })?.id),
          name: cleanText((s as { name?: unknown })?.name),
        }))
      : [],
  }));

  if (categories.length === 0) return { ok: false, message: "Laget behöver minst en kategori." };
  if (categories.length > MAX_CATEGORIES) {
    return { ok: false, message: `Högst ${MAX_CATEGORIES} kategorier.` };
  }
  if (categories.some((c) => !c.name)) return { ok: false, message: "Alla kategorier behöver ett namn." };
  if (categories.some((c) => c.subcategories.some((s) => !s.name))) {
    return { ok: false, message: "Alla underkategorier behöver ett namn." };
  }
  if (categories.some((c) => c.subcategories.length > MAX_SUBCATEGORIES)) {
    return { ok: false, message: `Högst ${MAX_SUBCATEGORIES} underkategorier per kategori.` };
  }
  const names = [...categories.map((c) => c.name), ...categories.flatMap((c) => c.subcategories.map((s) => s.name))];
  if (names.some((n) => n.length > MAX_NAME_LENGTH)) {
    return { ok: false, message: `Ett namn är för långt (högst ${MAX_NAME_LENGTH} tecken).` };
  }
  if (categories.some((c) => c.question.length > MAX_QUESTION_LENGTH)) {
    return { ok: false, message: `En fråga är för lång (högst ${MAX_QUESTION_LENGTH} tecken).` };
  }
  if (hasDuplicate(categories.map((c) => c.name))) {
    return { ok: false, message: "Två kategorier har samma namn." };
  }
  if (categories.some((c) => hasDuplicate(c.subcategories.map((s) => s.name)))) {
    return { ok: false, message: "Två underkategorier i samma kategori har samma namn." };
  }
  const ids = [
    ...categories.flatMap((c) => (c.id ? [c.id] : [])),
    ...categories.flatMap((c) => c.subcategories.flatMap((s) => (s.id ? [s.id] : []))),
  ];
  if (new Set(ids).size !== ids.length) return { ok: false, message: "Kategorierna kunde inte läsas. Försök igen." };

  return { ok: true, categories };
}

function hasDuplicate(names: readonly string[]): boolean {
  const lower = names.map((n) => n.toLocaleLowerCase("sv"));
  return new Set(lower).size !== lower.length;
}

/** Moves the item at `index` one step up (-1) or down (+1); out of range is a no-op. */
export function move<T>(items: readonly T[], index: number, step: -1 | 1): T[] {
  const target = index + step;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
