import { describe, expect, it } from "vitest";
import { isPublicPath } from "./proxy";

describe("isPublicPath", () => {
  it.each(["/logga-in", "/auth/callback", "/kom-igang", "/kom-igang/"])("%s is public", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each(["/", "/kom-igang/klubb", "/kom-igang/abc/spelare", "/inbjudan/abc", "/logga-inx"])(
    "%s needs a session",
    (path) => {
      expect(isPublicPath(path)).toBe(false);
    },
  );
});
