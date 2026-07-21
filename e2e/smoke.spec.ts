import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end smoke test on a mobile viewport (the primary use case: people
 * on phones at a restaurant table). Covers:
 *   sign up -> create group -> invite -> add multi-payer itemized expense
 *   -> simplify -> settle
 */

async function registerUser(page: Page, name: string, email: string) {
  await page.goto("/register");
  await page.fill("#name", name);
  await page.fill("#email", email);
  await page.fill("#password", "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL("/groups", { timeout: 15000 });
}

test("sign up, create group, invite, itemized multi-payer expense, simplify, settle", async ({
  browser,
}) => {
  const stamp = Date.now();
  const ownerEmail = `smoke-owner-${stamp}@example.com`;
  const joinerEmail = `smoke-joiner-${stamp}@example.com`;

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();

  await test.step("owner signs up", async () => {
    await registerUser(ownerPage, "Smoke Owner", ownerEmail);
  });

  await test.step("owner creates a group", async () => {
    await ownerPage.fill("#name", "Smoke Test Trip");
    await ownerPage.click('button:has-text("Create group")');
    await ownerPage.waitForURL(/\/groups\/[0-9a-f-]+$/, { timeout: 15000 });
  });

  const groupUrl = ownerPage.url();
  const inviteUrl = await ownerPage.locator("input[readonly]").inputValue();

  const joinerContext = await browser.newContext();
  const joinerPage = await joinerContext.newPage();

  await test.step("joiner signs up and joins via invite link", async () => {
    await registerUser(joinerPage, "Smoke Joiner", joinerEmail);
    await joinerPage.goto(inviteUrl);
    await joinerPage.waitForURL(groupUrl, { timeout: 15000 });
    await expect(joinerPage.getByText("Members (2)")).toBeVisible();
  });

  await test.step("owner adds a multi-payer itemized expense", async () => {
    await ownerPage.goto(`${groupUrl}/expenses/new`);
    await ownerPage.fill("#title", "Dinner out");
    await ownerPage.getByTestId("split-method-itemized").click();

    await ownerPage.getByTestId("item-name-0").fill("Steak");
    await ownerPage.getByTestId("item-price-0").fill("20.00");
    await ownerPage
      .locator('[data-testid="item-row-0"] label', { hasText: "Smoke Owner" })
      .getByRole("checkbox")
      .click();

    await ownerPage.getByTestId("add-item").click();
    await ownerPage.getByTestId("item-name-1").fill("Salad");
    await ownerPage.getByTestId("item-price-1").fill("10.00");
    await ownerPage
      .locator('[data-testid="item-row-1"] label', { hasText: "Smoke Joiner" })
      .getByRole("checkbox")
      .click();

    await ownerPage.fill("#taxTip", "5.00");

    // Multi-payer: owner pays $20, joiner pays $15 (sums to the $35 total).
    // The owner (current user) is checked as a payer by default.
    const payerRows = ownerPage.locator('[data-testid^="payer-row-"]');
    const ownerPayerRow = payerRows.filter({ hasText: "Smoke Owner" });
    const joinerPayerRow = payerRows.filter({ hasText: "Smoke Joiner" });
    await ownerPayerRow.locator("input[type=number]").fill("20.00");
    await joinerPayerRow.getByRole("checkbox").click();
    await joinerPayerRow.locator("input[type=number]").fill("15.00");

    await ownerPage.getByTestId("submit-expense").click();
    await ownerPage.waitForURL(groupUrl, { timeout: 15000 });
    await expect(ownerPage.getByText("Dinner out")).toBeVisible();
    await expect(ownerPage.getByText("$35.00")).toBeVisible();
  });

  await test.step("balances show one owing the other", async () => {
    await ownerPage.goto(`${groupUrl}/balances`);
    const netRows = ownerPage.locator('[data-testid^="net-"]');
    await expect(netRows).toHaveCount(2);
    const rowsText = await netRows.allTextContents();
    expect(rowsText.some((t) => t.includes("is owed"))).toBe(true);
    expect(rowsText.some((t) => t.includes("owes"))).toBe(true);
  });

  await test.step("simplify: confirm the suggested settlement", async () => {
    const confirmButton = ownerPage.locator('[data-testid^="confirm-suggestion-"]');
    await expect(confirmButton).toHaveCount(1);
    await confirmButton.click();
    await ownerPage.waitForTimeout(1000);
  });

  await test.step("settle: both members are now settled up", async () => {
    await ownerPage.goto(`${groupUrl}/balances`);
    const netRows = ownerPage.locator('[data-testid^="net-"]');
    const rowsText = await netRows.allTextContents();
    for (const text of rowsText) {
      expect(text).toContain("settled up");
    }
  });

  await ownerContext.close();
  await joinerContext.close();
});
