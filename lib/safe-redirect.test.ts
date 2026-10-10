import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("keeps local paths", () => {
    expect(safeNextPath("/inbjudan/abc?x=1")).toBe("/inbjudan/abc?x=1");
  });

  it.each([null, undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "evil"])(
    "falls back for %s",
    (next) => {
      expect(safeNextPath(next)).toBe("/");
    },
  );
});
