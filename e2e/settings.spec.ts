import { expect, test, type Page } from "@playwright/test";
import { signIn, signInHere, uniqueEmail } from "./helpers";

// Settings (step 6) on a club of its own, so the demo club the other tests
// read stays as seeded: categories, positions, display options, and what a
// leader may see.

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Signs up a new admin and creates an 11-a-side club without players. */
async function createClub(page: Page, project: string): Promise<string> {
  await page.goto("/kom-igang");
  await signInHere(page, uniqueEmail("installningar", project));
  await expect(page).toHaveURL(/\/kom-igang\/klubb$/);
  await page.getByLabel("Klubbens namn").fill(`Inställningsklubben ${project} ${Date.now()}`);
  await page.getByLabel("Lagets namn").fill("Herr A");
  await page.getByRole("group", { name: "Är några spelare under 18 år?" }).getByText("Nej", { exact: true }).click();
  await page.getByRole("button", { name: "Skapa klubben" }).click();
  await expect(page).toHaveURL(/\/kom-igang\/[0-9a-f-]+\/spelare$/);
  return page.url().match(/\/kom-igang\/([0-9a-f-]+)\//)![1];
}

test("an admin changes categories, positions and display options", async ({ page }, testInfo) => {
  const clubId = await createClub(page, testInfo.project.name);
  await page.goto(`/klubb/${clubId}/spelare`);
  await page.getByRole("link", { name: "Inställningar" }).click();
  await expect(page.getByRole("heading", { name: "Inställningar", level: 1 })).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Bedömningskategorier
  await page.getByRole("link", { name: /^Bedömningskategorier/ }).click();
  await expect(page.getByRole("heading", { name: "Bedömningskategorier", level: 1 })).toBeVisible();
  const list = page.getByRole("list", { name: "Kategorier" });
  await expect(list.getByRole("listitem")).toHaveCount(6);
  await expect(page.getByText("6 betyg per spelare")).toBeVisible();

  await list.getByLabel("Namn").first().fill("Bollteknik");
  await page.getByRole("button", { name: "Flytta ned Bollteknik" }).click();
  await expect(list.getByLabel("Namn").nth(1)).toHaveValue("Bollteknik");

  // Removing can be undone.
  await page.getByRole("button", { name: "Ta bort Utveckling" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(5);
  await page.getByRole("status").getByRole("button", { name: "Ångra" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(6);
  await page.getByRole("button", { name: "Ta bort Utveckling" }).click();

  // A new deepened category: three subcategories count as three ratings.
  await page.getByRole("button", { name: "+ Lägg till kategori" }).click();
  const added = list.getByRole("listitem").last();
  await added.getByLabel("Namn").fill("Målvaktsspel");
  await added.getByText("Fördjupa").click();
  await added.getByLabel("Underkategori 1", { exact: true }).fill("Utsparkar");
  await added.getByRole("button", { name: "+ Lägg till underkategori" }).click();
  await added.getByLabel("Underkategori 2", { exact: true }).fill("Räddningar");
  await added.getByRole("button", { name: "+ Lägg till underkategori" }).click();
  await added.getByLabel("Underkategori 3", { exact: true }).fill("Positionering");
  await expect(page.getByText("8 betyg per spelare")).toBeVisible();
  await expect(page.getByText("Osparade ändringar")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Spara ändringar" }).click();
  await expect(page.getByText("Sparat", { exact: true })).toBeVisible();

  await page.reload();
  await expect(list.getByLabel("Namn").nth(1)).toHaveValue("Bollteknik");
  await expect(list.getByRole("listitem")).toHaveCount(6);
  await expect(list.getByLabel("Underkategori 3", { exact: true })).toHaveValue("Positionering");
  const removed = page.getByRole("region", { name: "Borttagna kategorier" });
  await expect(removed).toContainText("Utveckling");
  await page.screenshot({ path: testInfo.outputPath("categories.png"), fullPage: true });

  // Positioner på planen: a new 11-a-side club starts with 4-4-2.
  await page.goto(`/klubb/${clubId}/installningar/positioner`);
  const presets = page.getByRole("region", { name: "Uppställningar" });
  await expect(presets.getByRole("button", { name: /^4-4-2/ })).toHaveAttribute("aria-pressed", "true");
  await presets.getByRole("button", { name: /^4-3-3/ }).click();
  await expect(presets.getByRole("button", { name: /^4-3-3/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("status").getByRole("button", { name: "Ångra" }).click();
  await expect(presets.getByRole("button", { name: /^4-4-2/ })).toHaveAttribute("aria-pressed", "true");

  await presets.getByRole("button", { name: /^4-3-3/ }).click();
  const pitch = page.getByRole("group", { name: "Planen" });
  await pitch.getByRole("button", { name: "Offensiv mittfältare, dold" }).click();
  await expect(page.getByText("12 spelare på planen")).toBeVisible();
  await expect(page.getByText(/Antalen blir 12, men laget spelar 11 mot 11/)).toBeVisible();
  await page.getByRole("button", { name: "Färre på Offensiv mittfältare" }).click();
  await expect(page.getByText("11 spelare på planen")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Spara ändringar" }).click();
  await expect(page.getByText("Sparat", { exact: true })).toBeVisible();

  await page.reload();
  await expect(pitch.getByRole("button", { name: "Offensiv mittfältare, visas, 0 behövs" })).toBeVisible();
  await expect(pitch.getByRole("button", { name: "Defensiv mittfältare, visas, 1 behövs" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("positions.png"), fullPage: true });

  // Visning: the screen-friendly mode says "Lägst".
  await page.goto(`/klubb/${clubId}/installningar`);
  await page.getByLabel(/^Skärmvänligt läge/).check();
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(page.getByText("Sparat", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(/^Skärmvänligt läge/)).toBeChecked();
  await expect(page.getByLabel(/^Anonym ledarvy/)).not.toBeChecked();
  await page.getByRole("link", { name: /^Så räknas det/ }).click();
  await expect(page.getByRole("heading", { name: "Lag, bäst och lägst" })).toBeVisible();
});

test("a leader reads Så räknas det but cannot open the admin settings", async ({ page }, testInfo) => {
  await signIn(page, testInfo.project.name === "mobile" ? "demo-ledare1@example.com" : "demo-ledare2@example.com");
  await page.getByRole("link", { name: "Bedöm spelare" }).first().click();

  const nav = page.getByRole("navigation", { name: "Klubbens sidor" });
  await expect(nav.getByRole("link", { name: "Inställningar" })).toHaveCount(0);
  await nav.getByRole("link", { name: "Så räknas det" }).click();
  await expect(page.getByRole("heading", { name: "Så räknas det", level: 1 })).toBeVisible();
  await expect(page.getByText(/Skiljer det 3 steg eller mer/)).toBeVisible();
  await expect(page.getByText("Nästan alltid: 95 %")).toBeVisible();
  await expectNoHorizontalScroll(page);

  const base = page.url().replace(/\/sa-raknas-det$/, "");
  for (const path of ["/kategorier", "/positioner"]) {
    // The page streams, so the 404 shows as the not-found page.
    await page.goto(`${base}${path}`);
    await expect(page.getByRole("heading", { name: "Sidan hittades inte" })).toBeVisible();
  }
  // The settings hub sends leaders to the one page they have.
  await page.goto(base);
  await expect(page).toHaveURL(/\/installningar\/sa-raknas-det$/);
});
