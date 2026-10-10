import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { signInHere, uniqueEmail } from "./helpers";

// Step 8: an admin rewrites texts in place, sends the guardian information,
// exports the club's data and deletes a player and then the whole club. Each
// run creates its own club, so the demo club is never touched.

const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54322/postgres";

/** Files left in Storage under the club's folder, in any bucket. */
async function storedFiles(clubId: string) {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    const { rows } = await db.query("select bucket_id, name from storage.objects where name like $1", [`${clubId}/%`]);
    return rows;
  } finally {
    await db.end();
  }
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function createClub(page: Page, clubName: string, email: string) {
  await page.goto("/kom-igang");
  await signInHere(page, email);
  await page.getByLabel("Klubbens namn").fill(clubName);
  await page.getByLabel("Lagets namn").fill("P13");
  await page.getByRole("group", { name: "Är några spelare under 18 år?" }).getByText("Ja", { exact: true }).click();
  await page.getByLabel("Klubbmärke (valfritt)").setInputFiles(path.join(__dirname, "fixtures/crest.png"));
  await page.getByRole("button", { name: "Skapa klubben" }).click();
  await expect(page).toHaveURL(/\/kom-igang\/[0-9a-f-]+\/spelare$/);
  const clubId = page.url().match(/kom-igang\/([0-9a-f-]+)\//)![1];
  await page.getByLabel("Spelarlista").fill("1 Test Ettan MV\n2 Test Tvåan FÖ");
  await page.getByRole("button", { name: "Lägg till i listan" }).click();
  await page.getByRole("button", { name: "Spara 2 spelare" }).click();
  await expect(page).toHaveURL(/\/ledare$/);
  return clubId;
}

test("an admin edits texts, informs guardians, exports and deletes data", async ({ browser, page }, testInfo) => {
  test.setTimeout(120_000);
  const project = testInfo.project.name;
  const clubName = `Integritets IF ${project} ${Date.now()}`;
  const clubId = await createClub(page, clubName, uniqueEmail("integritet", project));
  expect(await storedFiles(clubId)).toHaveLength(1);

  // Guardian information comes before the first assessment (players under 18).
  await page.goto(`/klubb/${clubId}/spelare`);
  const guardian = page.getByRole("region", { name: "Information till vårdnadshavare" });
  await expect(guardian).toContainText(`Vi ledare i ${clubName} (P13)`);
  await expect(guardian.getByRole("button", { name: "Kopiera texten" })).toBeVisible();
  await guardian.getByRole("button", { name: "Vårdnadshavarna har fått informationen" }).click();
  await expect(guardian).toHaveCount(0);

  // Redigera texter: drafts can be dropped with Ångra or saved with Spara.
  await page.getByRole("button", { name: "Redigera texter" }).click();
  await expect(page.getByRole("button", { name: "Redigera texter" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Redigera rubrik: Bedöm spelare" }).click();
  await page.getByRole("textbox", { name: "Redigera rubrik" }).fill("Ångrad rubrik");
  await page.getByRole("button", { name: "Klar" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ångrad rubrik");
  const bar = page.getByRole("region", { name: "Ändrade texter" });
  await expect(bar).toContainText("1 ändrade texter som inte är sparade");
  await bar.getByRole("button", { name: "Ångra" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bedöm spelare");

  await page.getByRole("button", { name: "Redigera rubrik: Bedöm spelare" }).click();
  await page.getByRole("textbox", { name: "Redigera rubrik" }).fill("Våra spelare");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Redigera text", exact: true }).click();
  await page.getByRole("textbox", { name: "Redigera text" }).fill("Bedöm lugnt, en spelare i taget.");
  await page.getByRole("button", { name: "Klar" }).click();
  await expect(bar).toContainText("2 ändrade texter");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("edit-texts.png"), fullPage: true });
  await bar.getByRole("button", { name: "Spara" }).click();
  await expect(bar).toContainText("Texterna är sparade");
  await page.getByRole("button", { name: "Redigera texter" }).click();

  // Saved texts apply for everyone, after a reload too.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Våra spelare", level: 1 })).toBeVisible();
  await expect(page.getByText("Bedöm lugnt, en spelare i taget.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Redigera rubrik/ })).toHaveCount(0);

  // Data och integritet
  await page.getByRole("link", { name: "Inställningar" }).click();
  await page.getByRole("link", { name: /Data och integritet/ }).click();
  await expect(page.getByRole("heading", { name: "Data och integritet", level: 1 })).toBeVisible();
  await expect(page.getByText("Vårdnadshavarna informerades")).toBeVisible();

  // Export as JSON and as a zip of CSV files.
  const [json] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Ladda ner som JSON" }).click(),
  ]);
  expect(json.suggestedFilename()).toMatch(/\.json$/);
  const data = JSON.parse(readFileSync((await json.path())!, "utf8"));
  expect(data.club.name).toBe(clubName);
  expect(data.tables.players.map((p: { full_name: string }) => p.full_name).sort()).toEqual([
    "Test Ettan",
    "Test Tvåan",
  ]);
  expect(data.tables.ui_text_overrides.map((t: { value: string }) => t.value)).toContain("Våra spelare");
  expect(JSON.stringify(data.tables.invites)).not.toContain("token");
  const [csv] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Ladda ner som CSV (zip-fil)" }).click(),
  ]);
  expect(csv.suggestedFilename()).toMatch(/-csv\.zip$/);

  // Deleting a player asks first; Esc cancels and focus goes back.
  const removeFirst = page.getByRole("button", { name: "Radera 1 Test Ettan" });
  await removeFirst.click();
  const dialog = page.getByRole("dialog", { name: "Radera 1 Test Ettan?" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(removeFirst).toBeFocused();
  await removeFirst.click();
  await dialog.getByRole("button", { name: "Radera för gott" }).click();
  await expect(page.getByText("1 Test Ettan är raderad.")).toBeVisible();
  await expect(removeFirst).toHaveCount(0);
  await expectNoHorizontalScroll(page);

  // The privacy page is open to anyone, signed in or not.
  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto("/integritet");
  await expect(visitorPage.getByRole("heading", { name: "Så hanteras personuppgifter" })).toBeVisible();
  await expect(visitorPage.getByText("Klubben är personuppgiftsansvarig", { exact: false }).first()).toBeVisible();
  await visitorPage.getByRole("link", { name: "Villkor" }).click();
  await expect(visitorPage.getByRole("heading", { name: "Användarvillkor" })).toBeVisible();
  await visitor.close();

  // Deleting the club needs its name typed in.
  await page.getByRole("button", { name: "Radera klubben …" }).click();
  const confirm = page.getByRole("dialog", { name: `Radera ${clubName}?` });
  const deleteButton = confirm.getByRole("button", { name: "Radera klubben för gott" });
  await expect(deleteButton).toBeDisabled();
  await confirm.getByLabel(/Skriv klubbens namn/).fill(clubName);
  await deleteButton.click();
  await expect(page).toHaveURL(/\/\?raderad=1$/);
  await expect(page.getByText("Klubben och all dess data är raderad.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: clubName })).toHaveCount(0);
  expect(await storedFiles(clubId)).toEqual([]);
  await page.goto(`/klubb/${clubId}/spelare`);
  await expect(page.getByRole("heading", { name: "Sidan hittades inte" })).toBeVisible();
});
