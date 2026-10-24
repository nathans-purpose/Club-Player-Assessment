import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

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

test("a user sets a password under Mitt konto and then signs in with it", async ({ page }, testInfo) => {
  const email = `losenord-${testInfo.project.name}-${Date.now()}@example.com`;
  const password = "hemligt-lösen-42";
  await signIn(page, email);
  await page.getByRole("link", { name: "Mitt konto" }).click();
  await expect(page.getByRole("heading", { name: "Mitt konto" })).toBeVisible();

  await page.getByLabel("Nytt lösenord").fill(password);
  await page.getByLabel("Skriv lösenordet igen").fill("något-annat");
  await page.getByRole("button", { name: "Spara lösenord" }).click();
  await expect(page.getByText("Lösenorden är inte likadana.")).toHaveAttribute("role", "alert");

  await page.getByLabel("Nytt lösenord").fill(password);
  await page.getByLabel("Skriv lösenordet igen").fill(password);
  await page.getByRole("button", { name: "Spara lösenord" }).click();
  await expect(page.getByText("Lösenordet är sparat.")).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Logga ut" }).click();
  await expect(page).toHaveURL(/\/logga-in$/);

  await page.getByLabel("E-postadress").fill(email);
  await page.getByLabel("Lösenord", { exact: true }).fill("fel-lösenord");
  await page.getByRole("button", { name: "Logga in", exact: true }).click();
  await expect(page.getByText("Fel e-postadress eller lösenord.")).toHaveAttribute("role", "alert");

  await page.getByLabel("Lösenord", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Logga in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Du är inte med i någon klubb än" })).toBeVisible();
});
