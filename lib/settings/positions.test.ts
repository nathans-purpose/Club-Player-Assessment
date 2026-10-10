import { describe, expect, it } from "vitest";
import { DEFAULT_FORMATIONS } from "@/lib/onboarding/defaults";
import {
  FORMATION_PRESETS,
  matchingPreset,
  MAX_TARGET,
  setTarget,
  targetTotal,
  togglePosition,
  validateTargets,
} from "./positions";

describe("formation presets", () => {
  it("has the five presets from the spec", () => {
    expect(FORMATION_PRESETS.map((p) => p.name)).toEqual(["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "7 mot 7"]);
  });

  it("puts 11 players on the pitch, or 7 in 7 mot 7", () => {
    for (const preset of FORMATION_PRESETS) {
      expect(targetTotal(preset.targets), preset.name).toBe(preset.id === "7-mot-7" ? 7 : 11);
      expect(preset.targets.MV, preset.name).toBe(1);
      expect(validateTargets(preset.targets).ok, preset.name).toBe(true);
    }
  });

  it("matches a new club's default formations for 11 and 7 players", () => {
    const fromDefaults = (format: 11 | 7) =>
      Object.fromEntries(DEFAULT_FORMATIONS[format].targets.map((t) => [t.position_code, t.target_count]));
    expect(matchingPreset(fromDefaults(11))?.id).toBe("4-4-2");
    expect(matchingPreset(fromDefaults(7))?.id).toBe("7-mot-7");
  });
});

describe("matchingPreset", () => {
  it("needs the same positions and counts", () => {
    const fourThreeThree = FORMATION_PRESETS.find((p) => p.id === "4-3-3")!;
    expect(matchingPreset({ ...fourThreeThree.targets })?.id).toBe("4-3-3");
    expect(matchingPreset({ ...fourThreeThree.targets, A: 2 })).toBeNull();
    expect(matchingPreset({ ...fourThreeThree.targets, OM: 0 })).toBeNull();
  });
});

describe("editing targets", () => {
  it("shows a hidden position with 1 and hides a shown one", () => {
    expect(togglePosition({ MV: 1 }, "A")).toEqual({ MV: 1, A: 1 });
    expect(togglePosition({ MV: 1, A: 2 }, "A")).toEqual({ MV: 1 });
  });

  it("keeps counts within 0 and the maximum, and ignores hidden positions", () => {
    expect(setTarget({ A: 1 }, "A", -1)).toEqual({ A: 0 });
    expect(setTarget({ A: 1 }, "A", 99)).toEqual({ A: MAX_TARGET });
    expect(setTarget({ A: 1 }, "MV", 2)).toEqual({ A: 1 });
  });
});

describe("validateTargets", () => {
  it("returns rows in pitch order", () => {
    expect(validateTargets({ A: 2, MV: 1, CM: 0 })).toEqual({
      ok: true,
      rows: [
        { position_code: "MV", target_count: 1 },
        { position_code: "CM", target_count: 0 },
        { position_code: "A", target_count: 2 },
      ],
    });
  });

  it("rejects unknown positions, bad counts and an empty pitch", () => {
    expect(validateTargets({ XX: 1 }).ok).toBe(false);
    expect(validateTargets({ MV: 1.5 }).ok).toBe(false);
    expect(validateTargets({ MV: MAX_TARGET + 1 }).ok).toBe(false);
    expect(validateTargets({ MV: "1" }).ok).toBe(false);
    expect(validateTargets({}).ok).toBe(false);
    expect(validateTargets([]).ok).toBe(false);
  });
});
