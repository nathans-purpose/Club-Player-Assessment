import { describe, expect, it } from "vitest";
import { formatInviteExpiry, inviteMailto, invitePath } from "./invites";

describe("invites", () => {
  it("builds the invite path", () => {
    expect(invitePath("abc123")).toBe("/inbjudan/abc123");
  });

  it("formats the expiry date in Swedish, in Swedish time", () => {
    expect(formatInviteExpiry("2026-10-16T23:30:00Z")).toBe("17 oktober");
  });

  it("builds a mailto link with the invite link in the body", () => {
    const href = inviteMailto({
      email: "ny+test@example.com",
      clubName: "Exempelklubben IF",
      appName: "Spelarbedömning",
      link: "https://app.example/inbjudan/abc",
      expires: "17 oktober",
      role: "leader",
    });
    const url = new URL(href);
    expect(url.protocol).toBe("mailto:");
    expect(decodeURIComponent(url.pathname)).toBe("ny+test@example.com");
    expect(url.searchParams.get("subject")).toBe("Inbjudan till Exempelklubben IF i Spelarbedömning");
    expect(url.searchParams.get("body")).toContain("https://app.example/inbjudan/abc");
    expect(url.searchParams.get("body")).toContain("som ledare i Exempelklubben IF");
  });
});
