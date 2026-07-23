import { test, expect, type Page } from "@playwright/test";

/**
 * Spot-checks the language toggle (en <-> km) and dark-mode toggle across
 * the main authenticated screens: no missing-string keys (a raw i18n key
 * looks like "namespace.key" and would stand out against real copy), and
 * the dark class actually reaches <html> and back.
 */

async function registerUser(page: Page, name: string, email: string) {
  await page.goto("/register");
  await page.fill("#name", name);
  await page.fill("#email", email);
  await page.fill("#password", "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL("/groups", { timeout: 15000 });
}

const MISSING_KEY_PATTERN = /\b[a-zA-Z]+(?:\.[a-zA-Z][a-zA-Z0-9]*){1,}\b/;
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

test.describe("language and theme toggles", () => {
  test("toggling language updates copy on every main screen with no missing keys", async ({
    page,
  }) => {
    const stamp = Date.now();
    await registerUser(page, "Toggle Tester", `toggle-${stamp}@example.com`);

    const screens = ["/groups", "/trips", "/account"];

    for (const path of screens) {
      await page.goto(path);
      const before = await page.locator("body").innerText();

      await page.getByRole("button", { name: /english.*ខ្មែរ/i }).first().click();
      // Locale switch round-trips through a server action + router.refresh()
      // (re-fetching the RSC tree), which is slower than a client state
      // update — poll instead of a fixed sleep.
      await expect(async () => {
        const current = await page.locator("body").innerText();
        expect(current).not.toBe(before);
      }).toPass({ timeout: 10_000 });

      const after = await page.locator("body").innerText();
      expect(after.replace(EMAIL_PATTERN, "")).not.toMatch(MISSING_KEY_PATTERN);

      // Toggle back to English for the next screen.
      await page.getByRole("button", { name: /english.*ខ្មែរ/i }).first().click();
      await expect(async () => {
        const current = await page.locator("body").innerText();
        expect(current).toBe(before);
      }).toPass({ timeout: 10_000 });
    }
  });

  test("dark mode toggle applies and clears the dark class on <html>", async ({
    page,
  }) => {
    const stamp = Date.now();
    await registerUser(page, "Theme Tester", `theme-${stamp}@example.com`);

    await page.goto("/account");
    await expect(page.locator("html")).not.toHaveClass(/dark/);

    await page.getByRole("button", { name: "dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.getByRole("button", { name: "light" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });
});
