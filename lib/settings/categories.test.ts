import { describe, expect, it } from "vitest";
import {
  estimatedMinutes,
  MAX_CATEGORIES,
  move,
  ratingsPerPlayer,
  RATINGS_WARNING_ABOVE,
  validateCategories,
} from "./categories";

const ID_A = "00000000-0000-4000-a000-00000000000a";
const ID_B = "00000000-0000-4000-a000-00000000000b";

const plain = (name: string, id: string | null = null) => ({ id, name, question: "", subcategories: [] });

describe("ratingsPerPlayer", () => {
  it("counts one rating per category and one per subcategory when deepened", () => {
    expect(ratingsPerPlayer([plain("Teknik"), plain("Fysik")])).toBe(2);
    expect(
      ratingsPerPlayer([
        { subcategories: [{ id: null, name: "Passning" }, { id: null, name: "Skott" }, { id: null, name: "Mottagning" }] },
        { subcategories: [] },
      ]),
    ).toBe(4);
  });

  it("is 0 for no categories", () => {
    expect(ratingsPerPlayer([])).toBe(0);
  });
});

describe("estimatedMinutes", () => {
  it("estimates per player and for the squad", () => {
    // 6 ratings × 10 s + 40 s = 100 s per player.
    expect(estimatedMinutes(6, 17)).toEqual({ perPlayer: 2, squad: 28 });
  });

  it("never says less than a minute per player", () => {
    expect(estimatedMinutes(1, 0)).toEqual({ perPlayer: 1, squad: 0 });
  });

  it("grows with the number of ratings, which is what the warning is about", () => {
    const atLimit = estimatedMinutes(RATINGS_WARNING_ABOVE, 20).squad;
    expect(estimatedMinutes(RATINGS_WARNING_ABOVE + 4, 20).squad).toBeGreaterThan(atLimit);
  });
});

describe("validateCategories", () => {
  it("trims names and questions and keeps valid ids", () => {
    const result = validateCategories([
      { id: ID_A, name: "  Teknik ", question: " Hur  bra? ", subcategories: [{ id: ID_B, name: " Passning " }] },
      { id: "not-a-uuid", name: "Fysik", question: "", subcategories: [] },
    ]);
    expect(result).toEqual({
      ok: true,
      categories: [
        { id: ID_A, name: "Teknik", question: "Hur bra?", subcategories: [{ id: ID_B, name: "Passning" }] },
        { id: null, name: "Fysik", question: "", subcategories: [] },
      ],
    });
  });

  it("needs at least one category, each with a name", () => {
    expect(validateCategories([])).toMatchObject({ ok: false, message: "Laget behöver minst en kategori." });
    expect(validateCategories([plain(" ")])).toMatchObject({ ok: false, message: "Alla kategorier behöver ett namn." });
    expect(
      validateCategories([{ id: null, name: "Teknik", question: "", subcategories: [{ id: null, name: "" }] }]),
    ).toMatchObject({ ok: false, message: "Alla underkategorier behöver ett namn." });
  });

  it("rejects duplicate names, case-insensitively", () => {
    expect(validateCategories([plain("Teknik"), plain("teknik")])).toMatchObject({ ok: false });
    expect(
      validateCategories([
        { id: null, name: "Teknik", question: "", subcategories: [{ id: null, name: "Skott" }, { id: null, name: "SKOTT" }] },
      ]),
    ).toMatchObject({ ok: false });
  });

  it("allows the same subcategory name in different categories", () => {
    const sub = [{ id: null, name: "Allmänt" }];
    expect(
      validateCategories([
        { id: null, name: "Teknik", question: "", subcategories: sub },
        { id: null, name: "Fysik", question: "", subcategories: sub },
      ]).ok,
    ).toBe(true);
  });

  it("rejects too many categories and repeated ids", () => {
    expect(
      validateCategories(Array.from({ length: MAX_CATEGORIES + 1 }, (_, i) => plain(`K${i}`))),
    ).toMatchObject({ ok: false });
    expect(validateCategories([plain("Teknik", ID_A), plain("Fysik", ID_A)])).toMatchObject({ ok: false });
  });

  it("rejects input that is not a list", () => {
    expect(validateCategories({ name: "Teknik" }).ok).toBe(false);
    expect(validateCategories(null).ok).toBe(false);
  });
});

describe("move", () => {
  it("swaps with the neighbour and ignores moves past the ends", () => {
    expect(move(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(move(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
    expect(move(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(move(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
  });
});
