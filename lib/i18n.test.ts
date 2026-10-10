import { describe, expect, it } from "vitest";
import { isTextKey, MAX_TEXT_LENGTH, planTextChanges, setRequestTexts, t, te } from "./i18n";

describe("t", () => {
  it("returns the fallback when there is no override", () => {
    expect(t("login.title", "Logga in")).toBe("Logga in");
  });

  it("prefers a club override", () => {
    expect(t("login.title", "Logga in", { "login.title": "Välkommen" })).toBe("Välkommen");
  });

  it("ignores a blank override", () => {
    expect(t("login.title", "Logga in", { "login.title": "  " })).toBe("Logga in");
  });

  it("keeps request overrides inside a server request only", () => {
    // Outside a React server render there is no request, so nothing leaks between calls.
    setRequestTexts({ "login.title": "Välkommen" });
    expect(t("login.title", "Logga in")).toBe("Logga in");
  });
});

describe("te", () => {
  it("keeps the key and default next to the club's text", () => {
    expect(te("players.title", "Bedöm spelare", { "players.title": "Spelarna" })).toEqual({
      textKey: "players.title",
      value: "Spelarna",
      fallback: "Bedöm spelare",
    });
  });
});

describe("planTextChanges", () => {
  it("stores changed texts, trimmed, and clears texts set back to their default", () => {
    expect(
      planTextChanges([
        { key: "players.title", value: "  Spelarna ", fallback: "Bedöm spelare" },
        { key: "overview.title", value: "Översikt", fallback: "Översikt" },
        { key: "overview.pitch", value: "   ", fallback: "Planen" },
      ]),
    ).toEqual({
      upsert: [{ key: "players.title", value: "Spelarna" }],
      remove: ["overview.title", "overview.pitch"],
      invalid: [],
    });
  });

  it("refuses odd keys and overly long texts", () => {
    const plan = planTextChanges([
      { key: "x; drop table", value: "a", fallback: "b" },
      { key: "players.intro", value: "a".repeat(MAX_TEXT_LENGTH + 1), fallback: "b" },
    ]);
    expect(plan.invalid).toEqual(["x; drop table", "players.intro"]);
    expect(plan.upsert).toEqual([]);
  });

  it("accepts the dotted keys the app uses", () => {
    expect(isTextKey("overview.rankings.hintLowest")).toBe(true);
    expect(isTextKey("squadGroup.MV")).toBe(true);
    expect(isTextKey(".bad")).toBe(false);
  });
});
