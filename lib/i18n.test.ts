import { describe, expect, it } from "vitest";
import { t } from "./i18n";

describe("t", () => {
  it("returns the fallback when there is no override", () => {
    expect(t("login.title", "Logga in")).toBe("Logga in");
  });

  it("prefers a club override", () => {
    expect(t("login.title", "Logga in", { "login.title": "Välkommen" })).toBe("Välkommen");
  });
});
