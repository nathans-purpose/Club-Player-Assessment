import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

// A leader opens Översikt on the demo club: KPIs, the pitch tooltip, radar,
// "Lag, bäst och svagast" with the quick view, and the sortable Data tab.

const EMAIL_BY_PROJECT: Record<string, string> = {
  mobile: "demo-ledare3@example.com",
  desktop: "demo-admin@example.com",
};

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("a leader explores the squad overview", async ({ page }, testInfo) => {
  await signIn(page, EMAIL_BY_PROJECT[testInfo.project.name]);
  await page.getByRole("link", { name: "Översikt" }).click();

  await expect(page.getByRole("heading", { name: "Översikt", level: 1 })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Översikt" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Lagets snitt")).toBeVisible();
  await expect(page.getByText("Väntar på bedömningar")).toHaveCount(0);
  await expectNoHorizontalScroll(page);

  // Pitch: a tap pins the tooltip with the players who can play there.
  const striker = page.getByRole("button", { name: /^Anfallare: \d av 2$/ });
  await striker.click();
  await expect(striker).toHaveAttribute("aria-expanded", "true");
  const tooltip = page.locator(`#${await striker.getAttribute("aria-controls")}`);
  await expect(tooltip).toContainText("Melvin Strand");
  await tooltip.getByRole("button", { name: "Stäng" }).click();
  // Focus goes back to the position, and the tooltip stays closed.
  await expect(striker).toBeFocused();
  await expect(striker).toHaveAttribute("aria-expanded", "false");

  // Keyboard focus shows it too, and Esc closes it.
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(striker).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(striker).toHaveAttribute("aria-expanded", "false");

  // Level chips narrow the pitch to natural players; all three is the default.
  const levelChips = page.getByRole("group", { name: "Räkna med" });
  await expect(levelChips.getByRole("button", { name: "Alla som kan spela" })).toHaveAttribute("aria-pressed", "true");
  await levelChips.getByRole("button", { name: "Bara naturliga" }).click();
  await expect(levelChips.getByRole("button", { name: "Bara naturliga" })).toHaveAttribute("aria-pressed", "true");
  await striker.click();
  await expect(tooltip).toContainText("Melvin Strand");
  await expect(tooltip).not.toContainText("Funkar bra");
  await expect(tooltip).not.toContainText("Kan spela");
  await striker.click();
  await levelChips.getByRole("button", { name: "Alla som kan spela" }).click();

  // Metric chips switch the pitch to an attribute.
  await page.getByRole("group", { name: "Visa på planen" }).getByRole("button", { name: "Teknik" }).click();
  await expect(page.getByRole("button", { name: /^Anfallare: \d,\d$/ })).toBeVisible();

  // Radar: compare the team with a squad group.
  await page.getByLabel("Jämför med").selectOption({ label: "Försvar" });
  await expect(page.getByRole("columnheader", { name: "Försvar" })).toBeVisible();

  // Bäst opens the quick view with the metric highlighted; Esc closes it.
  const goalsCard = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Mål per match" }) });
  await goalsCard.getByRole("button", { name: /^Bäst, Mål per match/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[aria-current="true"]').first()).toContainText("Mål per match");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // Lag opens the Data tab sorted by the metric.
  await goalsCard.getByRole("button", { name: /^Lag, Mål per match/ }).click();
  await expect(page.getByRole("tab", { name: "Data" })).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/flik=data/);
  const goalsHeader = page.getByRole("columnheader", { name: /Mål per match/ });
  await expect(goalsHeader).toHaveAttribute("aria-sort", "descending");
  await expectNoHorizontalScroll(page);

  // Sorting by a phase makes the attendance column follow it.
  await page.getByLabel("Sortera efter").selectOption({ label: "Närvaro: Försäsong" });
  await expect(page.getByRole("columnheader", { name: /Närvaro: Försäsong/ })).toHaveAttribute(
    "aria-sort",
    "descending",
  );

  // Squad-group filter and the quick view from a name.
  await page.getByLabel("Lagdel", { exact: true }).selectOption({ label: "Målvakt" });
  await expect(page.getByRole("tabpanel", { name: "Data" }).locator("tbody tr")).toHaveCount(2);
  await page.getByRole("button", { name: "Albin Ekström" }).click();
  await expect(page.getByRole("dialog", { name: "Albin Ekström" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Stäng" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  // Arrow keys move between the tabs.
  await page.getByRole("tab", { name: "Data" }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: "Översikt" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Översikt" })).toHaveAttribute("aria-selected", "true");
});
