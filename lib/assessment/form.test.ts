import { describe, expect, it } from "vitest";
import { type FormCategory, type FormState, fromPayload, missingItems, parsePayload, scoreKey, toPayload } from "./form";

const cat1 = "11111111-1111-4111-8111-111111111111";
const cat2 = "22222222-2222-4222-8222-222222222222";
const sub1 = "33333333-3333-4333-8333-333333333333";
const sub2 = "44444444-4444-4444-8444-444444444444";
const phase = "55555555-5555-4555-8555-555555555555";

const categories: FormCategory[] = [
  { id: cat1, name: "Teknik", question: null, subcategories: [{ id: sub1, name: "Passningar" }, { id: sub2, name: "Avslut" }] },
  { id: cat2, name: "Fysik", question: "Hur stark?", subcategories: [] },
];

const empty: FormState = { positions: {}, scores: {}, attendance: {}, comment: "" };

describe("missingItems", () => {
  it("lists positions first, then every unanswered rating in form order", () => {
    expect(missingItems(empty, categories).map((i) => i.id)).toEqual([
      "positions",
      scoreKey(cat1, sub1),
      scoreKey(cat1, sub2),
      cat2,
    ]);
  });

  it("asks for subcategory ratings, not the deepened category itself", () => {
    const state: FormState = { ...empty, positions: { CM: 3 }, scores: { [cat1]: 5, [cat2]: 6 } };
    expect(missingItems(state, categories).map((i) => i.id)).toEqual([scoreKey(cat1, sub1), scoreKey(cat1, sub2)]);
  });

  it("is empty when everything required is answered; attendance and comment are optional", () => {
    const state: FormState = {
      ...empty,
      positions: { MV: 1 },
      scores: { [scoreKey(cat1, sub1)]: 1, [scoreKey(cat1, sub2)]: 10, [cat2]: 5 },
    };
    expect(missingItems(state, categories)).toEqual([]);
  });
});

describe("toPayload and fromPayload", () => {
  const state: FormState = {
    positions: { CM: 3, OM: 1 },
    scores: { [scoreKey(cat1, sub1)]: 7, [cat2]: 4, stale: 9 },
    attendance: { [phase]: 80 },
    comment: "Bra",
  };

  it("sends only answers to the current categories", () => {
    expect(toPayload(state, categories)).toEqual({
      comment: "Bra",
      scores: [
        { categoryId: cat1, subcategoryId: sub1, score: 7 },
        { categoryId: cat2, subcategoryId: null, score: 4 },
      ],
      positions: [
        { code: "CM", level: 3 },
        { code: "OM", level: 1 },
      ],
      attendance: [{ phaseId: phase, value: 80 }],
    });
  });

  it("round-trips", () => {
    const scores = { ...state.scores };
    delete scores.stale;
    expect(fromPayload(toPayload(state, categories))).toEqual({ ...state, scores });
  });
});

describe("parsePayload", () => {
  const valid = {
    comment: "",
    scores: [{ categoryId: cat2, subcategoryId: null, score: 10 }],
    positions: [{ code: "A", level: 2 }],
    attendance: [{ phaseId: phase, value: 25 }],
  };

  it("accepts a valid payload", () => {
    expect(parsePayload(valid)).toEqual(valid);
  });

  it("drops unknown fields", () => {
    expect(parsePayload({ ...valid, leaderId: "x", scores: [{ ...valid.scores[0], extra: 1 }] })).toEqual(valid);
  });

  it.each([
    ["not an object", null],
    ["a score above 10", { ...valid, scores: [{ categoryId: cat2, subcategoryId: null, score: 11 }] }],
    ["a fractional score", { ...valid, scores: [{ categoryId: cat2, subcategoryId: null, score: 5.5 }] }],
    ["a bad category id", { ...valid, scores: [{ categoryId: "x", subcategoryId: null, score: 5 }] }],
    ["an unknown position", { ...valid, positions: [{ code: "XX", level: 2 }] }],
    ["a bad level", { ...valid, positions: [{ code: "A", level: 4 }] }],
    ["a bad attendance value", { ...valid, attendance: [{ phaseId: phase, value: 50 }] }],
    ["a duplicate score", { ...valid, scores: [valid.scores[0], valid.scores[0]] }],
    ["a duplicate position", { ...valid, positions: [valid.positions[0], { code: "A", level: 1 }] }],
    ["a long comment", { ...valid, comment: "x".repeat(2001) }],
    ["a missing list", { ...valid, positions: undefined }],
  ])("rejects %s", (_name, input) => {
    expect(parsePayload(input)).toBeNull();
  });
});
