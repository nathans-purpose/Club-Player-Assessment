import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { signIn, uniqueEmail } from "./helpers";

// Mobile and accessibility pass (spec §9): the main pages have no axe
// violations (WCAG 2.1 A and AA), fit 375 px without sideways scrolling, and
// every button and stand-alone link is at least 44 px tall.

const CLUB = "00000000-0000-4000-a000-000000000001";
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54322/postgres";

/** Makes a user an admin of the demo club (or removes them again), so tests don't share a sign-in. */
async function setDemoAdmin(email: string, add: boolean) {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    if (add) {
      await db.query(
        `insert into club_members (club_id, user_id, role)
         select $1, id, 'admin' from auth.users where email = $2 on conflict do nothing`,
        [CLUB, email],
      );
    } else {
      await db.query("delete from assessments where leader_id = (select id from auth.users where email = $1)", [email]);
      await db.query(
        "delete from club_members where club_id = $1 and user_id = (select id from auth.users where email = $2)",
        [CLUB, email],
      );
    }
  } finally {
    await db.end();
  }
}

async function check(page: Page, name: string) {
  await expect(page.locator("main").first()).toBeVisible();
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // Next.js's dev tools and route announcer are not part of the app.
    .exclude("nextjs-portal")
    .analyze();
  expect(violations.map((v) => `${name}: ${v.id} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`)).toEqual([]);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${name} scrolls sideways`).toBeLessThanOrEqual(0);

  // Touch targets: buttons, and links that stand on their own (not inside running text).
  const small = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "main button, main a[href], header button, header a[href], footer a[href]",
      ),
    ]
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const inText = el.tagName === "A" && el.closest("p, li > span, td") && !el.className.includes("min-h");
        return !inText && rect.height < 43.5;
      })
      .map(
        (el) =>
          `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}" ${Math.round(el.getBoundingClientRect().height)}px`,
      ),
  );
  expect(small, `${name} has small touch targets`).toEqual([]);
}

test("public pages", async ({ page }) => {
  for (const [path, name] of [
    ["/logga-in", "Logga in"],
    ["/kom-igang", "Kom igång 1"],
    ["/integritet", "Integritet"],
    ["/villkor", "Villkor"],
  ]) {
    await page.goto(path);
    await check(page, name);
  }
});

test("club pages for an admin", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("tillganglighet", testInfo.project.name);
  await signIn(page, email);
  await setDemoAdmin(email, true);
  await page.reload();
  await check(page, "Startsidan");
  const base = `/klubb/${CLUB}`;
  for (const [path, name] of [
    ["/spelare", "Bedöm spelare"],
    ["/oversikt", "Översikt"],
    ["/oversikt?flik=data", "Data"],
    ["/installningar", "Inställningar"],
    ["/installningar/kategorier", "Bedömningskategorier"],
    ["/installningar/positioner", "Positioner på planen"],
    ["/installningar/sa-raknas-det", "Så räknas det"],
    ["/installningar/visuell-identitet", "Visuell identitet"],
    ["/installningar/data", "Data och integritet"],
  ]) {
    await page.goto(base + path);
    await expect(page, name).toHaveURL(new RegExp(`${path.replace("?", "\\?")}$`));
    await check(page, name);
  }

  for (const [path, name] of [
    ["/kom-igang/klubb", "Kom igång 2"],
    [`/kom-igang/${CLUB}/spelare`, "Kom igång 3"],
    [`/kom-igang/${CLUB}/ledare`, "Kom igång 4"],
  ]) {
    await page.goto(path);
    await check(page, name);
  }

  // A player card, submitted, and its combined view.
  await page.goto(`${base}/spelare`);
  await page
    .getByRole("link", { name: /Ej påbörjad/ })
    .first()
    .click();
  await expect(page.getByRole("button", { name: "Skicka in" })).toBeVisible();
  await check(page, "Spelarkort");
  await page.getByRole("button", { name: "Central mittfältare: inte vald" }).click();
  await page.getByRole("dialog", { name: "Central mittfältare" }).getByRole("button", { name: "Naturlig" }).click();
  const sevens = page.locator("label").filter({ hasText: /^7$/ });
  for (let i = 0; i < (await sevens.count()); i++) await sevens.nth(i).click();
  await page.getByRole("button", { name: "Skicka in" }).click();
  await expect(page.getByRole("heading", { name: "Tack!" })).toBeVisible();
  await check(page, "Tack");
  await page.getByRole("link", { name: "Se samlad bedömning först" }).click();
  await expect(page.getByText("Samlad bedömning", { exact: true }).first()).toBeVisible();
  await check(page, "Samlad bedömning");

  // Redigera texter in edit mode.
  await page.goto(`${base}/spelare`);
  await page.getByRole("button", { name: "Redigera texter" }).click();
  await check(page, "Redigera texter");

  // Leave the demo club as it was (the assessment goes with the membership's user).
  await setDemoAdmin(email, false);
});
