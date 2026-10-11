import { expect, test, type Page } from "@playwright/test";
import { signInHere, uniqueEmail } from "./helpers";

// Säsong on a club of its own: log a match, evaluate the season, read the
// summary, and plan the next season with a priority from the evaluation and
// a recruitment target.

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

// Next.js keeps up to three earlier pages in the DOM, hidden, so text and
// tab lookups only count what is on screen.
function seasonTab(page: Page, name: string) {
  return page.getByRole("navigation", { name: "Säsongens sidor" }).getByRole("link", { name, exact: true }).filter({ visible: true });
}

async function openSeason(page: Page, label: string) {
  await expect(page.getByRole("heading", { name: `Säsong ${label}`, level: 1 })).toBeVisible();
}

async function createClub(page: Page, project: string): Promise<string> {
  await page.goto("/kom-igang");
  await signInHere(page, uniqueEmail("sasong", project));
  await expect(page).toHaveURL(/\/kom-igang\/klubb$/);
  await page.getByLabel("Klubbens namn").fill(`Säsongsklubben ${project} ${Date.now()}`);
  await page.getByLabel("Lagets namn").fill("Herr A");
  await page.getByRole("group", { name: "Är några spelare under 18 år?" }).getByText("Nej", { exact: true }).click();
  await page.getByRole("button", { name: "Skapa klubben" }).click();
  await expect(page).toHaveURL(/\/kom-igang\/[0-9a-f-]+\/spelare$/);
  return page.url().match(/\/kom-igang\/([0-9a-f-]+)\//)![1];
}

test("leaders evaluate a season and plan the next one", async ({ page }, testInfo) => {
  // A long flow: sign-up, a match, an evaluation and a plan.
  test.setTimeout(120_000);
  const year = new Date().getFullYear();
  const clubId = await createClub(page, testInfo.project.name);

  await page.goto(`/klubb/${clubId}/spelare`);
  await page.getByRole("link", { name: "Säsong", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Säsong", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: `Säsong ${year}` })).toBeVisible();
  await expectNoHorizontalScroll(page);

  // The admin adds next season; it opens on its plan.
  await expect(page.getByLabel("Säsong", { exact: true })).toHaveValue(String(year + 1));
  await page.getByRole("button", { name: "Lägg till" }).click();
  await expect(page).toHaveURL(/\/sasong\/[0-9a-f-]+\/planering$/);
  const nextSeasonUrl = page.url();
  await openSeason(page, String(year + 1));

  // This season: one match.
  await page.getByRole("link", { name: String(year), exact: true }).filter({ visible: true }).click();
  await openSeason(page, String(year));
  await seasonTab(page, "Resultat").click();
  await expect(page).toHaveURL(/\/resultat$/);
  await expect(page.getByText("Inga matcher inlagda än.").filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: "+ Lägg till match" }).click();
  // Rows are named after their content, so find them by place in the list.
  const match = page.getByRole("list", { name: "Matcher" }).getByRole("listitem").first();
  await match.getByLabel("Motståndare").fill("Testlaget");
  await match.getByLabel("Plats").selectOption({ label: "Hemma" });
  await match.getByLabel("Gjorda").fill("2");
  await match.getByLabel("Insläppta").fill("1");
  await expect(match.getByText("Vinst")).toBeVisible();
  await match.getByRole("button", { name: "Spara" }).click();
  await expect(match.getByText("Sparat")).toBeVisible();
  await page.getByLabel("Slutplacering i serien").fill("4");
  await page.getByRole("button", { name: "Spara", exact: true }).last().click();
  await expect(page.getByText("Sparat").filter({ visible: true }).last()).toBeVisible();

  // The summary counts it, but hides the ratings until the leader has submitted.
  await seasonTab(page, "Sammanställning").click();
  await expect(page).toHaveURL(/\/sasong\/[0-9a-f-]+$/);
  await expect(page.getByText("Poäng per match").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("Fyll i din egen utvärdering först.", { exact: false }).filter({ visible: true })).toBeVisible();

  // Own evaluation: one area, a strength, then submit.
  await page.getByRole("link", { name: "Till min utvärdering" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/min-utvardering$/);
  await expect(page.getByRole("heading", { name: "Min utvärdering" }).filter({ visible: true })).toBeVisible();
  await page.getByRole("radiogroup", { name: "Betyg: Speluppbyggnad" }).getByText("4", { exact: true }).click();
  await page
    .getByRole("radiogroup", { name: "Tränade vi tillräckligt på det?" })
    .first()
    .getByText("För lite")
    .click();
  await expect(page.getByText("Sparat").filter({ visible: true })).toBeVisible();
  await page.getByLabel("Styrka 1").fill("Vi gav aldrig upp");
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Skicka in" }).click();

  await expect(page).toHaveURL(/\?inskickad=1$/);
  await expect(page.getByText("Tack! Din utvärdering är inskickad.").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("1 av 1 ledare har skickat in sin utvärdering.").filter({ visible: true })).toBeVisible();
  const areas = page.getByRole("table", { name: /Per område/ });
  await expect(areas.getByRole("row", { name: /Speluppbyggnad/ })).toContainText("4,0");
  await expect(page.getByText("Vi gav aldrig upp").filter({ visible: true })).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Next season's plan: strategy, a priority suggested by the evaluation, a recruit.
  await page.goto(nextSeasonUrl);
  await page.getByLabel("Målsättning").fill("Topp tre");
  await page.getByRole("button", { name: "Spara strategin" }).click();
  await expect(page.getByText("Sparat").first()).toBeVisible();

  await page.getByRole("button", { name: /^Lägg till Speluppbyggnad/ }).click();
  const priority = page.getByRole("list", { name: "Förbättringsområden" }).getByRole("listitem").first();
  await expect(priority.getByLabel("Område")).toHaveValue("Speluppbyggnad");
  await priority.getByLabel("Åtgärd").fill("Uppspelsövning varje tisdag");
  await priority.getByRole("button", { name: "Spara" }).click();
  await expect(priority.getByText("Sparat")).toBeVisible();

  await page.getByRole("button", { name: "+ Lägg till spelare" }).click();
  const recruit = page.getByRole("list", { name: "Värvningsönskemål" }).getByRole("listitem").first();
  await recruit.getByLabel("Namn").fill("Extern Testspelare");
  await recruit.getByLabel("Position").selectOption({ label: "Anfallare" });
  await recruit.getByRole("button", { name: "Spara" }).click();
  await expect(recruit.getByText("Sparat")).toBeVisible();

  // The squad table counts the recruit as on its way at Anfallare.
  await expect(page.getByRole("row", { name: /Anfallare/ })).toContainText("Extern Testspelare");
  await page.getByRole("button", { name: "Spara truppen" }).click();
  await expect(page.getByText("Sparat").last()).toBeVisible();
  await expectNoHorizontalScroll(page);
});
