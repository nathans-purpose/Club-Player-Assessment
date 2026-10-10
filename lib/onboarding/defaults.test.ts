import { describe, expect, it } from "vitest";
import { DEFAULT_FORMATIONS, GAME_FORMATS } from "./defaults";

const POSITION_CODES = ["MV", "VB", "VMB", "HMB", "HB", "DM", "VM", "CM", "HM", "OM", "VY", "HY", "A"];

describe("DEFAULT_FORMATIONS", () => {
  it.each(GAME_FORMATS)("%i mot %i fills the pitch with one goalkeeper", (format) => {
    const { targets } = DEFAULT_FORMATIONS[format];
    expect(targets.reduce((sum, t) => sum + t.target_count, 0)).toBe(format);
    expect(targets.find((t) => t.position_code === "MV")?.target_count).toBe(1);
    for (const t of targets) expect(POSITION_CODES).toContain(t.position_code);
    expect(new Set(targets.map((t) => t.position_code)).size).toBe(targets.length);
  });
});
