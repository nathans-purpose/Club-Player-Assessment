import { expect, test, type Page } from "@playwright/test";
import { signInHere, uniqueEmail } from "./helpers";

// Visual identity (step 7) on a club of its own: read a brand document (the
// Claude API is mocked by e2e/mock-anthropic.mjs), check the suggestion,
// upload a font file, save, and see the theme on the club's pages.

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function createClub(page: Page, project: string): Promise<{ clubId: string; name: string }> {
  const name = `Identitetsklubben ${project} ${Date.now()}`;
  await page.goto("/kom-igang");
  await signInHere(page, uniqueEmail("identitet", project));
  await expect(page).toHaveURL(/\/kom-igang\/klubb$/);
  await page.getByLabel("Klubbens namn").fill(name);
  await page.getByLabel("Lagets namn").fill("Herr A");
  await page.getByRole("group", { name: "Är några spelare under 18 år?" }).getByText("Nej", { exact: true }).click();
  await page.getByRole("button", { name: "Skapa klubben" }).click();
  await expect(page).toHaveURL(/\/kom-igang\/[0-9a-f-]+\/spelare$/);
  return { clubId: page.url().match(/\/kom-igang\/([0-9a-f-]+)\//)![1], name };
}

const rootVar = (page: Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

test("an admin reads a brand document, reviews it and applies it to the club", async ({ page }, testInfo) => {
  const { clubId, name } = await createClub(page, testInfo.project.name);
  // The app's default look until an identity is applied.
  await page.goto(`/klubb/${clubId}/spelare`);
  expect(await rootVar(page, "--primary")).toBe("#1f5c3a");
  await page.goto(`/klubb/${clubId}/installningar`);
  await page.getByRole("link", { name: /^Visuell identitet/ }).click();
  await expect(page.getByRole("heading", { name: "Visuell identitet", level: 1 })).toBeVisible();
  await expect(page.getByText(/Inga loggor ännu/)).toBeVisible();

  // Read the brand document: a picture with the club's blue crest on white.
  await page.getByLabel("Välj dokument").setInputFiles("e2e/fixtures/brand.png");
  await expect(page.getByText("Förslaget från brand.png är ifyllt nedan. Kontrollera det och spara.")).toBeVisible();

  const colors = page.getByRole("list", { name: "Klubbens färger" });
  await expect(colors.getByRole("listitem")).toHaveCount(2);
  await expect(colors.getByRole("listitem").first().getByLabel("Hex-kod")).toHaveValue("#509BF5");
  await expect(colors.getByRole("listitem").first().getByLabel("Används som")).toHaveValue("primary");
  await expect(colors.getByRole("listitem").nth(1).getByLabel("Används som")).toHaveValue("secondary");

  // The main colour is too light for text: the page says so and derives a darker one.
  const contrast = page.getByRole("region", { name: "Kontroll av läsbarhet" });
  await expect(contrast).toContainText("bara kontrasten 2,85:1");
  await expect(contrast).toContainText("Knappar i huvudfärgen får mörk text.");

  // The logo is cut out of the picture with a transparent background.
  const logos = page.getByRole("list", { name: "Klubbens loggor" });
  await expect(logos.getByRole("img", { name: "Klubbmärke" })).toBeVisible();
  const corner = await logos.getByRole("img", { name: "Klubbmärke" }).evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const mid = ctx.getImageData(img.naturalWidth / 2, img.naturalHeight / 2, 1, 1).data[3];
    return { corner: ctx.getImageData(0, 0, 1, 1).data[3], mid };
  });
  expect(corner).toEqual({ corner: 0, mid: 255 });

  // Fonts: Druk Wide is licensed, so Archivo stands in until the file is uploaded.
  const heading = page.getByRole("group", { name: "Rubriker" });
  await expect(heading.getByLabel("Typsnittets namn")).toHaveValue("Druk Wide");
  await expect(heading.getByLabel("Utseende")).toHaveValue("extended");
  await expect(heading.getByText(/Tills du laddar upp den visar vi Archivo Expanded/)).toBeVisible();
  const body = page.getByRole("group", { name: "Brödtext" });
  await body.getByLabel("Ladda upp typsnittsfil för brödtext").setInputFiles({
    name: "Inter.woff2",
    mimeType: "font/woff2",
    buffer: Buffer.from("wOF2-not-a-real-font"),
  });
  await expect(body.getByText("Inter.woff2 laddas upp när du sparar.")).toBeVisible();
  await expect(page.getByLabel("Ord som beskriver klubbens ton")).toHaveValue("Stolt, Modig");

  // The preview switches between the club's theme and the default one.
  const toggle = page.getByRole("group", { name: "Visa förhandsvisningen med" });
  await toggle.getByRole("button", { name: "Standardtema" }).click();
  await expect(toggle.getByRole("button", { name: "Standardtema" })).toHaveAttribute("aria-pressed", "true");
  await toggle.getByRole("button", { name: "Klubbens tema" }).click();
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("identity.png"), fullPage: true });

  await page.getByRole("button", { name: "Spara och använd för hela klubben" }).click();
  await expect(page.getByText("Sparat. Klubbens tema används nu på alla klubbens sidor.")).toBeVisible();

  // Every club page now uses the club's colours, logo and fallback fonts.
  await page.goto(`/klubb/${clubId}/spelare`);
  await expect(page.getByRole("banner").getByRole("img", { name })).toBeVisible();
  expect(await rootVar(page, "--primary")).toBe("#509BF5");
  expect(await rootVar(page, "--on-primary")).toBe("#14171A");
  expect(await rootVar(page, "--primary-ink")).not.toBe("#509BF5");
  expect(await rootVar(page, "--heading-stretch")).toBe("125%");
  expect(await rootVar(page, "--scale-low")).toBe("#e5484d");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("themed.png"), fullPage: true });

  // The saved identity loads back, with the font file stored.
  await page.goto(`/klubb/${clubId}/installningar/visuell-identitet`);
  await expect(page.getByRole("group", { name: "Brödtext" }).getByText("Typsnittsfilen är uppladdad.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Klubbens loggor" }).getByRole("listitem")).toHaveCount(1);

  // Going back to the default look needs a confirmation.
  await page.getByRole("button", { name: "Sluta använda klubbens tema" }).click();
  await page.getByRole("button", { name: "Avbryt" }).click();
  await page.getByRole("button", { name: "Sluta använda klubbens tema" }).click();
  await page.getByRole("button", { name: "Ja, använd standardtemat" }).click();
  await expect(page.getByText("Klubbens sidor använder standardtemat igen.")).toBeVisible();
  await page.goto(`/klubb/${clubId}/spelare`);
  expect(await rootVar(page, "--primary")).toBe("#1f5c3a");
});

test("colours and fonts can be entered by hand and wrong values are pointed out", async ({ page }, testInfo) => {
  const { clubId } = await createClub(page, testInfo.project.name);
  await page.goto(`/klubb/${clubId}/installningar/visuell-identitet`);

  await page.getByRole("button", { name: "+ Lägg till färg" }).click();
  const color = page.getByRole("list", { name: "Klubbens färger" }).getByRole("listitem").first();
  await color.getByLabel("Hex-kod").fill("#12");
  await page.getByRole("button", { name: "Spara och använd för hela klubben" }).click();
  await expect(page.getByText("Rätta de markerade fälten först.")).toBeVisible();
  await expect(color.getByLabel("Hex-kod")).toBeFocused();
  await color.getByLabel("Hex-kod").fill("#0b1f3a");

  // Removing a colour can be undone.
  await color.getByRole("button", { name: "Ta bort färg 1" }).click();
  await page.getByRole("button", { name: "Ångra" }).click();
  await expect(page.getByRole("list", { name: "Klubbens färger" }).getByRole("listitem")).toHaveCount(1);

  // A dark main colour reads well and keeps white button text.
  await expect(page.getByRole("region", { name: "Kontroll av läsbarhet" })).toContainText("går att läsa som text");
  await page.getByRole("group", { name: "Rubriker" }).getByRole("button", { name: "+ Lägg till typsnitt för rubriker" }).click();
  await page.getByRole("group", { name: "Rubriker" }).getByLabel("Typsnittets namn").fill("Georgia");
  await page.getByRole("group", { name: "Rubriker" }).getByLabel("Utseende").selectOption("serif");

  await page.getByRole("button", { name: "Spara och använd för hela klubben" }).click();
  await expect(page.getByText("Sparat. Klubbens tema används nu på alla klubbens sidor.")).toBeVisible();
  await page.goto(`/klubb/${clubId}/oversikt`);
  expect(await rootVar(page, "--primary")).toBe("#0B1F3A");
  expect(await rootVar(page, "--on-primary")).toBe("#FFFFFF");
  expect(await rootVar(page, "--font-heading")).toContain("Georgia");
});

test("a PDF brand document is drawn page by page in the browser before it is read", async ({ page }, testInfo) => {
  const { clubId } = await createClub(page, testInfo.project.name);
  await page.goto(`/klubb/${clubId}/installningar/visuell-identitet`);
  await page.getByLabel("Välj dokument").setInputFiles("e2e/fixtures/brand.pdf");
  await expect(page.getByText("Förslaget från brand.pdf är ifyllt nedan. Kontrollera det och spara.")).toBeVisible();
  const last = (await (await fetch("http://127.0.0.1:4010/last")).json()) as { images: number };
  expect(last.images).toBe(1);
  await expect(page.getByRole("list", { name: "Klubbens loggor" }).getByRole("listitem")).toHaveCount(1);
});
