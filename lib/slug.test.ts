import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it.each([
    ["Råsunda IK", "rasunda-ik"],
    ["  Östra Göinge BK  ", "ostra-goinge-bk"],
    ["IFK Ängby/Södra", "ifk-angby-sodra"],
    ["FC 2000!", "fc-2000"],
    ["---", "klubb"],
  ])("%s → %s", (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });

  it("matches the database's slug format and length", () => {
    const slug = slugify("A".repeat(80) + " B");
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});
