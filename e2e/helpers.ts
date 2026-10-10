import { expect, type Page } from "@playwright/test";

// Local Supabase sends magic links to Mailpit.
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type MailSummary = { ID: string };

async function messageIds(email: string): Promise<Set<string>> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  const { messages } = (await res.json()) as { messages: MailSummary[] };
  return new Set(messages.map((m) => m.ID));
}

async function newMagicLink(email: string, seen: Set<string>): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const fresh = [...(await messageIds(email))].find((id) => !seen.has(id));
    if (fresh) {
      const message = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${fresh}`)).json()) as { Text: string };
      const link = message.Text.match(/https?:\/\/\S+\/auth\/v1\/verify\S+/)?.[0];
      if (link) return link.replace(/[)\]]+$/, "");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No magic link email for ${email}`);
}

/** Requests a magic link on the current page's login form and opens it. */
export async function signInHere(page: Page, email: string) {
  const seen = await messageIds(email);
  await page.getByLabel("E-postadress").fill(email);
  // Supabase allows one email per address per second; the mobile and desktop
  // runs share the seeded accounts, so retry once after a rate-limit message.
  await expect(async () => {
    await page.getByRole("button", { name: "Skicka inloggningslänk" }).click();
    await expect(page.getByText("Kolla din e-post")).toBeVisible({ timeout: 2000 });
  }).toPass({ intervals: [1500], timeout: 10_000 });
  await page.goto(await newMagicLink(email, seen));
}

export async function signIn(page: Page, email: string) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/logga-in/);
  await signInHere(page, email);
}

/** A unique address per test run and Playwright project. */
export function uniqueEmail(prefix: string, project: string) {
  return `${prefix}-${project}-${Date.now()}@example.com`;
}
