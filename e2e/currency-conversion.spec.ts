import { test, expect, type Page } from "@playwright/test";

/**
 * Verifies the "type in either currency, auto-convert to the group's
 * centralized currency" feature end-to-end: setting a group's exchange
 * rate, then entering amounts in KHR via ConvertibleAmountInput's toggle
 * on a USD-based group, and confirming the stored/displayed amount is the
 * correctly converted USD figure.
 */

async function registerUser(page: Page, name: string, email: string) {
  await page.goto("/register");
  await page.fill("#name", name);
  await page.fill("#email", email);
  await page.fill("#password", "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL("/groups", { timeout: 15000 });
}

test("entering an amount in KHR converts to the group's USD base currency", async ({ page }) => {
  const stamp = Date.now();
  await registerUser(page, "Currency Tester", `currency-${stamp}@example.com`);

  await page.fill("#name", "Currency Test Group");
  await page.getByTestId("submit-create-group").click();
  await page.waitForURL(/\/groups\/[0-9a-f-]+$/, { timeout: 15000 });
  const groupUrl = page.url();

  await test.step("owner sets the group's exchange rate to 4000 riel/USD", async () => {
    await page.fill("#usdKhrRate", "4000");
    await page.getByTestId("save-exchange-rate").click();
    // Button label is a transient, translated "saving/saved/save" — wait
    // for the disabled "saving" state to clear rather than matching text.
    await expect(page.getByTestId("save-exchange-rate")).toBeEnabled({ timeout: 10_000 });
    await page.reload();
    await expect(page.locator("#usdKhrRate")).toHaveValue("4000");
  });

  await test.step("total entered in KHR converts to the correct USD amount", async () => {
    await page.goto(`${groupUrl}/expenses/new`);
    await page.fill("#title", "Riel-denominated dinner");

    // Total field starts in the group's base currency (USD); toggle it to
    // KHR and type riel directly.
    await page.getByTestId("total-currency-toggle").click();
    await page.getByTestId("total").fill("40000");

    // Single payer (the owner, already checked by default for a new
    // expense) must match the total exactly -- enter their payer amount
    // in KHR too, via the same per-field toggle, to prove independently-
    // converted fields still reconcile (40000 / 4000 = $10.00 either way,
    // no rounding drift).
    const payerRows = page.locator('[data-testid^="payer-row-"]');
    const ownerPayerRow = payerRows.filter({ hasText: "Currency Tester" });
    await ownerPayerRow.locator('[data-testid$="-currency-toggle"]').click();
    await ownerPayerRow.locator("input[type=number]").fill("40000");

    await page.getByTestId("submit-expense").click();
    await page.waitForURL(groupUrl, { timeout: 15000 });

    await expect(page.getByText("Riel-denominated dinner")).toBeVisible();
    // $10.00 USD, formatted via the group's own (USD) currency -- proves
    // both the total and the payer amount landed in cents correctly.
    await expect(page.getByTestId("expense-amount")).toContainText("$10.00");
  });
});

test("recording a settlement in KHR converts to the group's USD base currency", async ({
  browser,
}) => {
  const stamp = Date.now();
  const ownerEmail = `rp-owner-${stamp}@example.com`;
  const joinerEmail = `rp-joiner-${stamp}@example.com`;

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await registerUser(ownerPage, "RP Owner", ownerEmail);
  await ownerPage.fill("#name", "RP Test Group");
  await ownerPage.getByTestId("submit-create-group").click();
  await ownerPage.waitForURL(/\/groups\/[0-9a-f-]+$/, { timeout: 15000 });
  const groupUrl = ownerPage.url();
  const inviteUrl = await ownerPage.locator("input[readonly]").inputValue();

  const joinerContext = await browser.newContext();
  const joinerPage = await joinerContext.newPage();
  await registerUser(joinerPage, "RP Joiner", joinerEmail);
  await joinerPage.goto(inviteUrl);
  await joinerPage.waitForURL(groupUrl, { timeout: 15000 });

  await ownerPage.goto(groupUrl);
  await ownerPage.fill("#usdKhrRate", "4000");
  await ownerPage.getByTestId("save-exchange-rate").click();
  await expect(ownerPage.getByTestId("save-exchange-rate")).toBeEnabled({ timeout: 10_000 });

  await ownerPage.goto(`${groupUrl}/balances`);
  await ownerPage.getByTestId("record-payment-trigger").click();
  await ownerPage.locator("#from").click();
  await ownerPage.getByRole("listbox").getByRole("option", { name: "RP Joiner" }).click();
  // Wait for the "from" trigger to reflect the selection (and its popup
  // to fully close) before opening "to" -- otherwise the still-closing
  // first popup's now-hidden option can end up matched instead.
  await expect(ownerPage.locator("#from")).toContainText("RP Joiner");
  await expect(ownerPage.getByRole("listbox")).toHaveCount(0);
  await ownerPage.locator("#to").click();
  await ownerPage.getByRole("listbox").getByRole("option", { name: "RP Owner" }).click();

  // ៛80,000 at 4000 riel/USD -> $20.00.
  await ownerPage.getByTestId("record-payment-amount-currency-toggle").click();
  await ownerPage.getByTestId("record-payment-amount").fill("80000");

  await ownerPage.getByTestId("submit-record-payment").click();
  await expect(ownerPage.getByTestId("record-payment-trigger")).toBeVisible({ timeout: 10_000 });

  await ownerPage.goto(`${groupUrl}/activity`);
  await expect(ownerPage.getByText("$20.00")).toBeVisible();

  await ownerContext.close();
  await joinerContext.close();
});
