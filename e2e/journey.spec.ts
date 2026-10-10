import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { signInHere, uniqueEmail } from "./helpers";

// The whole way through, as a new club would use the app (spec §11, step 8):
// sign up → create the club → import the squad from a file → invite a leader
// → the leader assesses a player → both see it in Översikt. The file import
// talks to e2e/mock-anthropic.mjs instead of the Claude API.

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Fills in a whole player card (a position, every rating, one attendance answer) and submits it. */
async function assess(page: Page, rating: string) {
  await page.getByRole("button", { name: "Central mittfältare: inte vald" }).click();
  await page.getByRole("dialog", { name: "Central mittfältare" }).getByRole("button", { name: "Naturlig" }).click();
  const ratings = page.locator("label").filter({ hasText: new RegExp(`^${rating}$`) });
  const count = await ratings.count();
  for (let i = 0; i < count; i++) await ratings.nth(i).click();
  await page
    .locator("label")
    .filter({ hasText: /^Ofta$/ })
    .first()
    .click();
  await expect(page.getByRole("status").filter({ hasText: "Sparat" })).toBeVisible();
  await page.getByRole("button", { name: "Skicka in" }).click();
  await expect(page.getByRole("heading", { name: "Tack!" })).toBeVisible();
}

test("a new club signs up, imports its squad, invites a leader, assesses and sees the overview", async ({
  browser,
  page,
}, testInfo) => {
  // Two users, a file import and two assessments: longer than one screen's test.
  test.setTimeout(180_000);
  const project = testInfo.project.name;
  const adminEmail = uniqueEmail("resa-admin", project);
  const leaderEmail = uniqueEmail("resa-ledare", project);
  const clubName = `Resans IK ${project} ${Date.now()}`;

  // 1. Sign up
  await page.goto("/kom-igang");
  await signInHere(page, adminEmail);

  // 2. Club
  await expect(page).toHaveURL(/\/kom-igang\/klubb$/);
  await page.getByLabel("Klubbens namn").fill(clubName);
  await page.getByLabel("Lagets namn").fill("Herr A");
  await page.getByRole("group", { name: "Är några spelare under 18 år?" }).getByText("Nej", { exact: true }).click();
  await page.getByRole("button", { name: "Skapa klubben" }).click();

  // 3. Import the squad from a file and fix what the review table points out
  await expect(page).toHaveURL(/\/kom-igang\/[0-9a-f-]+\/spelare$/);
  const clubId = page.url().match(/kom-igang\/([0-9a-f-]+)\//)![1];
  await page.getByLabel("Välj fil").setInputFiles(path.join(__dirname, "fixtures/trupp.csv"));
  await expect(page.getByText("5 spelare hittades i trupp.csv.")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Det stämmer, spelare 3" }).click();
  await page.getByRole("button", { name: "Ta bort spelare 5" }).click();
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Spara 4 spelare" }).click();

  // 4. Invite a leader
  await expect(page).toHaveURL(/\/kom-igang\/[0-9a-f-]+\/ledare$/);
  await page.getByLabel("E-postadress, Ledare 1").fill(leaderEmail);
  await page.getByRole("button", { name: "Skapa inbjudningar" }).click();
  const pending = page.getByRole("region", { name: "Väntar på svar" }).getByRole("listitem");
  const mailto = await pending.getByRole("link", { name: "Skicka e-post" }).getAttribute("href");
  const inviteLink = new URL(mailto!).searchParams.get("body")!.match(/https?:\/\/\S+\/inbjudan\/\S+/)![0];

  // 5. The leader joins and assesses a player
  const leaderContext = await browser.newContext({ viewport: page.viewportSize() });
  const leader = await leaderContext.newPage();
  await leader.goto(inviteLink);
  await signInHere(leader, leaderEmail);
  await leader.getByRole("button", { name: `Gå med i ${clubName}` }).click();
  await expect(leader.getByRole("listitem").filter({ hasText: clubName })).toContainText("Ledare");
  await leader.goto(`/klubb/${clubId}/spelare`);
  await expect(leader.getByText("0 av 4 spelare bedömda")).toBeVisible();
  // Leaders never see admin controls.
  await expect(leader.getByRole("button", { name: "Redigera texter" })).toHaveCount(0);
  await expect(leader.getByRole("link", { name: "Inställningar" })).toHaveCount(0);
  await leader.getByRole("link", { name: /Test Anfallsson/ }).click();
  await assess(leader, "9");
  await expect(leader.getByText("1 av 4 spelare bedömda")).toBeVisible();
  await expectNoHorizontalScroll(leader);

  // The admin assesses the same player.
  await page.goto(`/klubb/${clubId}/spelare`);
  await page.getByRole("link", { name: /Test Anfallsson/ }).click();
  await assess(page, "6");

  // 6. Översikt: the KPIs count both assessments and flag the disagreement.
  await page.getByRole("link", { name: "Översikt" }).click();
  await expect(page.getByRole("heading", { name: "Översikt", level: 1 })).toBeVisible();
  const kpis = page.getByRole("region", { name: "Nyckeltal" });
  await expect(kpis).toContainText(/Lagets snitt\s*7,5/);
  await expect(kpis).toContainText(/2\s*av 8 möjliga/);
  await expect(kpis).toContainText(/Oeniga\s*1\s*spelare att diskutera/);
  await expectNoHorizontalScroll(page);
  await page.getByRole("tab", { name: "Data" }).click();
  const row = page.getByRole("row").filter({ hasText: "Test Anfallsson" });
  await expect(row).toContainText("7,5");
  await page.screenshot({ path: testInfo.outputPath("overview-data.png"), fullPage: true });

  // The leader sees the same combined view, with their own score as "Du".
  await leader.goto(`/klubb/${clubId}/spelare`);
  await leader
    .getByRole("link", { name: /Test Anfallsson/ })
    .first()
    .click();
  await leader.getByRole("link", { name: "Se samlad bedömning" }).click();
  await expect(leader.getByText("Du: 9").first()).toBeVisible();
  await expect(leader.getByText("Oeniga – diskutera").first()).toBeVisible();
  await leaderContext.close();
});
