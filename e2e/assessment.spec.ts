import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { signIn } from "./helpers";

// A demo leader assesses a player end to end: list → form with autosave →
// submit → thank-you → combined view, then resubmits.
// Each Playwright project uses its own leader and player; the test clears that
// assessment first so it can run again.

const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54322/postgres";
// Leader and a player the seed leaves unassessed for that leader, per project.
const SETUP_BY_PROJECT: Record<string, { email: string; player: string }> = {
  mobile: { email: "demo-ledare1@example.com", player: "Theo Wikström" },
  desktop: { email: "demo-ledare2@example.com", player: "Gustav Falk" },
};

async function clearAssessment(email: string, playerName: string) {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    await db.query(
      `delete from assessments a using players p, auth.users u
       where p.id = a.player_id and u.id = a.leader_id and p.full_name = $1 and u.email = $2`,
      [playerName, email],
    );
  } finally {
    await db.end();
  }
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

function progressCount(text: string | null) {
  return Number(text?.match(/(\d+) av \d+ spelare bedömda/)?.[1]);
}

test("a leader assesses a player, sees the combined view and resubmits", async ({ page }, testInfo) => {
  const { email, player: playerName } = SETUP_BY_PROJECT[testInfo.project.name];
  await clearAssessment(email, playerName);

  await signIn(page, email);
  await page.getByRole("link", { name: "Bedöm spelare" }).click();

  // Player list with status and search
  await expect(page.getByRole("heading", { name: "Bedöm spelare" })).toBeVisible();
  const before = progressCount(await page.getByText(/spelare bedömda/).first().textContent());
  await page.getByLabel("Sök spelare").fill(playerName.split(" ")[0].toLowerCase());
  const row = page.getByRole("link", { name: new RegExp(playerName) });
  await expect(row).toContainText("Ej påbörjad");
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expectNoHorizontalScroll(page);
  const playerHref = await row.getAttribute("href");

  // The combined view stays closed until the leader has submitted.
  await page.goto(`${playerHref}/samlad`);
  await expect(page).toHaveURL(new RegExp(`${playerHref}$`));

  // Submitting an empty form points at the first missing item instead.
  await expect(page.getByRole("heading", { name: playerName })).toBeVisible();
  await page.getByRole("button", { name: "Skicka in" }).click();
  await expect(page.getByText("Det här saknas").first()).toBeVisible();
  await expect(page.locator("#item-positions")).toContainText("Det här saknas");
  await expect(page).toHaveURL(new RegExp(`${playerHref}$`));

  // Positions: tap a spot and choose a level
  await page.getByRole("button", { name: "Central mittfältare: inte vald" }).click();
  const popover = page.getByRole("dialog", { name: "Central mittfältare" });
  await popover.getByRole("button", { name: "Naturlig" }).click();
  await expect(page.getByRole("button", { name: "Central mittfältare: Naturlig" })).toBeVisible();
  await page.getByRole("button", { name: "Anfallare: inte vald" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Kan spela" }).click();

  // Ratings: 7 everywhere (two rows of five on mobile)
  const sevens = page.locator("label").filter({ hasText: /^7$/ });
  const count = await sevens.count();
  expect(count).toBeGreaterThanOrEqual(6);
  for (let i = 0; i < count; i++) await sevens.nth(i).click();
  await page.locator("label").filter({ hasText: /^Ofta$/ }).first().click();
  await page.getByLabel("Kommentar").fill("Läser spelet bra.");
  await expect(page.getByRole("status").filter({ hasText: "Sparat" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("card.png"), fullPage: true });

  // The draft survives a reload and shows as Utkast in the list.
  await page.reload();
  await expect(page.getByRole("button", { name: "Central mittfältare: Naturlig" })).toBeVisible();
  await expect(page.getByLabel("Kommentar")).toHaveValue("Läser spelet bra.");
  await page.getByRole("link", { name: "← Alla spelare" }).click();
  await page.getByLabel("Sök spelare").fill(playerName);
  await expect(page.getByRole("link", { name: new RegExp(playerName) })).toContainText("Utkast");
  await page.getByRole("link", { name: new RegExp(playerName) }).click();

  // Submit → thank-you
  await page.getByRole("button", { name: "Skicka in" }).click();
  await expect(page.getByRole("heading", { name: "Tack!" })).toBeVisible();
  const after = progressCount(await page.getByText(/spelare bedömda/).first().textContent());
  expect(after).toBe(before + 1);
  await expect(page.getByRole("link", { name: /Nästa spelare →/ })).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Combined view
  await page.getByRole("link", { name: "Se samlad bedömning först" }).click();
  await expect(page.getByRole("heading", { name: playerName })).toBeVisible();
  await expect(page.getByText("Samlad bedömning", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Du: 7").first()).toBeVisible();
  // The card page stays in the DOM (hidden) after navigating, so match the comment paragraph.
  await expect(page.locator("p", { hasText: "Läser spelet bra." })).toBeVisible();
  await expect(page.getByText("Central mittfältare", { exact: true })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("combined.png"), fullPage: true });

  // Resubmitting changes the answers but not the progress count.
  await page.getByRole("link", { name: "Din bedömning" }).click();
  await expect(page.getByText("Ändringar sparas när du skickar in igen.")).toBeVisible();
  await page.locator("label").filter({ hasText: /^8$/ }).first().click();
  await expect(page.getByText("Ändringar ej inskickade")).toBeVisible();
  await page.getByRole("button", { name: "Skicka in igen" }).click();
  await expect(page.getByRole("heading", { name: "Tack!" })).toBeVisible();
  expect(progressCount(await page.getByText(/spelare bedömda/).first().textContent())).toBe(after);
});

test("a leader skips a player they can't assess, then assesses them anyway", async ({ page }, testInfo) => {
  const { email, player: assessedName } = SETUP_BY_PROJECT[testInfo.project.name];
  // A player this leader has neither submitted nor drafted in the seed.
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  let playerName: string;
  try {
    await db.query(
      "delete from assessments a using auth.users u where u.id = a.leader_id and u.email = $1 and a.status = 'skipped'",
      [email],
    );
    playerName = (
      await db.query<{ full_name: string }>(
        `select p.full_name from players p
         where p.is_active and p.full_name <> $2
           and not exists (
             select 1 from assessments a join auth.users u on u.id = a.leader_id
             where a.player_id = p.id and u.email = $1
           )
         order by p.full_name limit 1`,
        [email, assessedName],
      )
    ).rows[0].full_name;
  } finally {
    await db.end();
  }

  await signIn(page, email);
  await page.getByRole("link", { name: "Bedöm spelare" }).click();
  await page.getByLabel("Sök spelare").fill(playerName.split(" ")[0].toLowerCase());
  const row = page.getByRole("link", { name: new RegExp(playerName) });
  const playerHref = (await row.getAttribute("href"))!;
  await row.click();
  await expect(page.getByRole("heading", { name: playerName })).toBeVisible();

  // Hoppa över moves on to another player.
  await page.getByRole("button", { name: "Hoppa över" }).click();
  await expect(page).not.toHaveURL(new RegExp(`${playerHref}$`));

  // The list marks the player as skipped and counts them apart.
  await page.goto(playerHref.replace(/\/[^/]+$/, ""));
  await expect(page.getByText(/spelare bedömda \(1 överhoppad\)/).first()).toBeVisible();
  await page.getByLabel("Sök spelare").fill(playerName.split(" ")[0].toLowerCase());
  await expect(page.getByRole("link", { name: new RegExp(playerName) })).toContainText("Överhoppad");
  await expectNoHorizontalScroll(page);

  // Undoing the skip brings the form back.
  await page.goto(playerHref);
  await expect(page.getByRole("heading", { name: "Du har hoppat över spelaren" })).toBeVisible();
  await page.getByRole("button", { name: "Bedöm ändå" }).click();
  await expect(page.getByRole("button", { name: "Skicka in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hoppa över" })).toBeVisible();
  await clearAssessment(email, playerName);
});
