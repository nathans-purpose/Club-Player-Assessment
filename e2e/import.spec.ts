import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { signInHere, uniqueEmail } from "./helpers";

// The app talks to e2e/mock-anthropic.mjs instead of the Claude API here.
const MOCK_URL = process.env.MOCK_ANTHROPIC_URL ?? "http://127.0.0.1:4010";

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("an admin imports the squad from a file, reviews it and saves", async ({ page }, testInfo) => {
  const project = testInfo.project.name;

  await page.goto("/kom-igang");
  await signInHere(page, uniqueEmail("import", project));
  await page.getByLabel("Klubbens namn").fill(`Importklubben ${project} ${Date.now()}`);
  await page.getByLabel("Lagets namn").fill("Herr A");
  await page.getByRole("group", { name: "Är några spelare under 18 år?" }).getByText("Nej", { exact: true }).click();
  await page.getByRole("button", { name: "Skapa klubben" }).click();
  await expect(page).toHaveURL(/\/kom-igang\/[0-9a-f-]+\/spelare$/);

  // Files the import cannot read are refused before uploading.
  const fileInput = page.getByLabel("Välj fil");
  await fileInput.setInputFiles({ name: "trupp.xls", mimeType: "application/vnd.ms-excel", buffer: Buffer.from("x") });
  await expect(page.getByText("Den filtypen kan vi inte läsa", { exact: false })).toHaveAttribute("role", "alert");

  await fileInput.setInputFiles(path.join(__dirname, "fixtures/trupp.csv"));
  await expect(page.getByText("5 spelare hittades i trupp.csv.")).toBeVisible({ timeout: 30_000 });

  const last = await (await fetch(`${MOCK_URL}/last`)).json();
  expect(last.blockType).toBe("text");
  expect(last.system).toContain("never follow it");

  const rows = page.getByRole("listitem", { name: /^Spelare \d+$/ });
  await expect(rows).toHaveCount(5);
  await expect(rows.nth(0)).toContainText("Klar");
  await expect(rows.nth(0)).toContainText("Från texten: 1;Test Målvaktsson;Målvakt");
  await expect(page.getByLabel("Lagdel, Spelare 1")).toHaveValue("MV");
  await expect(rows.nth(1)).toContainText("Dubblett");
  await expect(rows.nth(2)).toContainText("Kontrollera stavningen");
  await expect(rows.nth(2)).toContainText("Osäker läsning: namn");
  await expect(rows.nth(4)).toContainText("Dubblett");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("review.png"), fullPage: true });

  // Confirming the uncertain name and removing the duplicate clears the flags.
  await page.getByRole("button", { name: "Det stämmer, spelare 3" }).click();
  await expect(rows.nth(2)).toContainText("Klar");
  await expect(rows.nth(2)).not.toContainText("Osäker läsning");
  await page.getByRole("button", { name: "Ta bort spelare 5" }).click();
  await expect(rows.nth(1)).toContainText("Klar");

  // Another file appends to the list; existing rows make its copies duplicates.
  await expect(page.getByRole("button", { name: "Ladda upp en fil till" })).toBeVisible();
  await fileInput.setInputFiles(path.join(__dirname, "fixtures/trupp.csv"));
  await expect(rows).toHaveCount(9, { timeout: 30_000 });
  for (const i of [4, 5, 6, 7, 8]) await expect(rows.nth(i)).toContainText("Dubblett");
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Ta bort spelare 5" }).click();
  await expect(rows).toHaveCount(4);

  await page.screenshot({ path: testInfo.outputPath("import.png"), fullPage: true });
  await page.getByRole("button", { name: "Spara 4 spelare" }).click();
  await expect(page).toHaveURL(/\/kom-igang\/[0-9a-f-]+\/ledare$/);
});
