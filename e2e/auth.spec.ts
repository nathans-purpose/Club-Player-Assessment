import { expect, test, type Page } from "@playwright/test";

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

async function signIn(page: Page, email: string) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/logga-in/);
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

test("signed-out visitors are sent to the login page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/logga-in$/);
  await expect(page.getByRole("heading", { name: "Logga in eller skapa konto" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fortsätt med Google" })).toBeVisible();
  await expect(page.getByText("Har du fått en inbjudan?")).toBeVisible();
});

test("an invalid email is rejected with a Swedish message", async ({ page }) => {
  await page.goto("/logga-in");
  await page.getByLabel("E-postadress").fill("inte-en-adress");
  await page.getByRole("button", { name: "Skicka inloggningslänk" }).click();
  await expect(page.getByText("Skriv en giltig e-postadress.")).toHaveAttribute("role", "alert");
});

test("a seeded admin signs in with a magic link and sees their club", async ({ page }, testInfo) => {
  await signIn(page, "demo-admin@example.com");
  await expect(page.getByRole("heading", { name: "Hej Demo Admin!" })).toBeVisible();
  const club = page.getByRole("listitem").filter({ hasText: "Exempelklubben IF" });
  await expect(club).toContainText("Admin");
  await page.screenshot({ path: testInfo.outputPath("home.png"), fullPage: true });

  await page.getByRole("button", { name: "Logga ut" }).click();
  await expect(page).toHaveURL(/\/logga-in$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/logga-in$/);
});

test("a new user without a club sees how to join one", async ({ page }) => {
  await signIn(page, `ny-${Date.now()}@example.com`);
  await expect(page.getByRole("heading", { name: "Du är inte med i någon klubb än" })).toBeVisible();
});

test("a broken sign-in link shows an error", async ({ page }) => {
  await page.goto("/auth/callback?code=ogiltig");
  await expect(page).toHaveURL(/\/logga-in\?fel=lank$/);
  await expect(page.getByText("Länken är ogiltig")).toHaveAttribute("role", "alert");
});
