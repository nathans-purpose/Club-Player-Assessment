import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { signInHere, uniqueEmail } from "./helpers";

// Every step must fit a 375 px screen without sideways scrolling.
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("an admin creates a club, adds players and invites a leader who joins", async ({ browser, page }, testInfo) => {
  const project = testInfo.project.name;
  const adminEmail = uniqueEmail("grundare", project);
  const leaderEmail = uniqueEmail("ledare", project);
  const clubName = `Testklubben ${project} ${Date.now()}`;

  // Kom igång 1: account
  await page.goto("/kom-igang");
  await expect(page.getByRole("heading", { name: "Skapa ditt konto" })).toBeVisible();
  await expect(page.getByText("Har du fått en inbjudan?")).toBeVisible();
  await signInHere(page, adminEmail);

  // Kom igång 2: club, with a live preview
  await expect(page).toHaveURL(/\/kom-igang\/klubb$/);
  await page.getByRole("button", { name: "Skapa klubben" }).click();
  await expect(page.getByText("Skriv klubbens namn.")).toBeVisible();
  await expect(page.getByText("Svara ja eller nej.")).toBeVisible();

  const preview = page.getByRole("complementary", { name: "Förhandsvisning" });
  await page.getByLabel("Klubbens namn").fill(clubName);
  await page.getByLabel("Lagets namn").fill("P15");
  await page.getByText("9 mot 9").click();
  await page.getByRole("group", { name: "Är några spelare under 18 år?" }).getByText("Ja", { exact: true }).click();
  await page.getByLabel("Klubbmärke (valfritt)").setInputFiles(path.join(__dirname, "fixtures/crest.png"));
  await expect(preview).toContainText(clubName);
  await expect(preview).toContainText("P15");
  await expect(preview).toContainText("9 mot 9");
  await expect(preview).toContainText("Spelare under 18");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("club.png"), fullPage: true });
  await page.getByRole("button", { name: "Skapa klubben" }).click();

  // Kom igång 3: players, pasted and reviewed
  await expect(page).toHaveURL(/\/kom-igang\/[0-9a-f-]+\/spelare$/);
  await expect(page.getByRole("heading", { name: "Lägg till spelarna" })).toBeVisible();
  await expect(page.getByText("klubbmärket kunde inte laddas upp")).toHaveCount(0);
  await page
    .getByLabel("Spelarlista")
    .fill(
      "1 Test Målvaktsson MV\n7 Test Mittfältsson mittfält\n7 Test Mittfältsson mittfält\nEnsam\nTest Utannummer anfall",
    );
  await page.getByRole("button", { name: "Lägg till i listan" }).click();
  await expect(page.getByText("5 spelare har lagts till i listan.")).toBeVisible();

  const rows = page.getByRole("listitem", { name: /^Spelare \d+$/ });
  await expect(rows).toHaveCount(5);
  await expect(rows.nth(0)).toContainText("Klar");
  await expect(rows.nth(1)).toContainText("Dubblett");
  await expect(rows.nth(2)).toContainText("Dubblett");
  await expect(rows.nth(3)).toContainText("Kontrollera stavningen");
  await expect(rows.nth(4)).toContainText("Nummer saknas");
  await expect(rows.nth(1)).toContainText("Från texten: 7 Test Mittfältsson mittfält");

  await page.getByLabel("Visa bara de som behöver kontrolleras").check();
  await expect(rows).toHaveCount(4);
  await page.getByLabel("Visa bara de som behöver kontrolleras").uncheck();

  // Saving with duplicates is refused; removing one fixes both rows.
  await page.getByRole("button", { name: "Spara 5 spelare" }).click();
  await expect(page.getByText("Ta bort eller ändra dubbletterna innan du sparar.")).toHaveAttribute("role", "alert");
  await page.getByRole("button", { name: "Ta bort spelare 3" }).click();
  await expect(page.getByText("Spelaren togs bort.")).toBeVisible();
  await expect(rows.nth(1)).toContainText("Klar");

  // Edits re-derive the status, and a manual row can be added.
  await page.getByLabel("Namn, Spelare 3").fill("Ensam Spelarsson");
  await page.getByLabel("Nr, Spelare 3").fill("10");
  await expect(rows.nth(2)).toContainText("Välj lagdel");
  await page.getByLabel("Lagdel, Spelare 3").selectOption("MF");
  await expect(rows.nth(2)).toContainText("Klar");
  await page.getByRole("button", { name: "+ Lägg till spelare" }).click();
  await page.getByLabel("Nr, Spelare 5").fill("4");
  await page.getByLabel("Namn, Spelare 5").fill("Test Backsson");
  await page.getByLabel("Lagdel, Spelare 5").selectOption("FÖ");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("players.png"), fullPage: true });
  await page.getByRole("button", { name: "Spara 5 spelare" }).click();

  // Kom igång 4: leaders
  await expect(page).toHaveURL(/\/kom-igang\/[0-9a-f-]+\/ledare$/);
  await expect(page.getByRole("heading", { name: "Bjud in ledarna" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nästa steg (valfritt)" })).toBeVisible();

  const firstEmail = page.getByLabel("E-postadress, Ledare 1");
  await firstEmail.fill("inte-en-adress");
  await firstEmail.blur();
  await expect(page.getByText("Skriv en giltig e-postadress.")).toBeVisible();
  await firstEmail.fill(leaderEmail);
  await page.getByRole("button", { name: "Skapa inbjudningar" }).click();
  await expect(page.getByText("Inbjudan är skapad.")).toBeVisible();

  const pending = page.getByRole("region", { name: "Väntar på svar" }).getByRole("listitem");
  await expect(pending).toHaveCount(1);
  await expect(pending).toContainText(leaderEmail);
  await expect(pending).toContainText("Ledare");
  const mailto = await pending.getByRole("link", { name: "Skicka e-post" }).getAttribute("href");
  const inviteLink = new URL(mailto!).searchParams.get("body")!.match(/https?:\/\/\S+\/inbjudan\/\S+/)![0];

  // Inviting the same address again does not create a second invite.
  await page.getByLabel("E-postadress, Ledare 1").fill(leaderEmail);
  await page.getByRole("button", { name: "Skapa inbjudningar" }).click();
  await expect(page.getByText("Redan inbjudna eller med i klubben")).toBeVisible();
  await expect(pending).toHaveCount(1);

  await page.getByRole("button", { name: "Skapa inbjudningslänk" }).click();
  await expect(page.getByRole("textbox", { name: "Inbjudningslänk" })).toHaveValue(/\/inbjudan\/[0-9a-f]+$/);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("leaders.png"), fullPage: true });

  // The invited leader signs in through the invite link and joins.
  const leaderContext = await browser.newContext();
  const leaderPage = await leaderContext.newPage();
  await leaderPage.goto(inviteLink);
  await expect(leaderPage).toHaveURL(/\/logga-in\?next=/);
  await expect(leaderPage.getByText("Logga in för att gå med i klubben")).toBeVisible();
  await signInHere(leaderPage, leaderEmail);
  await expect(leaderPage.getByRole("heading", { name: `Gå med i ${clubName}` })).toBeVisible();
  await leaderPage.getByRole("button", { name: `Gå med i ${clubName}` }).click();
  await expect(leaderPage.getByRole("listitem").filter({ hasText: clubName })).toContainText("Ledare");
  await leaderContext.close();

  // Back with the admin: the leader is now a member and the invite is gone.
  await page.reload();
  await expect(page.getByRole("region", { name: "Med i klubben" })).toContainText(leaderEmail);
  await expect(page.getByRole("region", { name: "Väntar på svar" })).toHaveCount(0);

  await page.getByRole("link", { name: "Klart, gå till startsidan" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: clubName })).toContainText("Admin");
});

test("onboarding steps after the first need an account", async ({ page }) => {
  await page.goto("/kom-igang/klubb");
  await expect(page).toHaveURL(/\/logga-in\?next=%2Fkom-igang%2Fklubb$/);
});

test("an unknown invite shows a clear message", async ({ page }, testInfo) => {
  await page.goto("/inbjudan/finns-inte");
  await signInHere(page, uniqueEmail("okand", testInfo.project.name));
  await expect(page.getByRole("heading", { name: "Inbjudan hittades inte" })).toBeVisible();
});
