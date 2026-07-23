import path from "node:path";
import dotenv from "dotenv";
import postgres from "postgres";
import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end Trip Agenda journey on a mobile viewport. Covers, per the
 * verification checklist:
 *   create trip (linked to a group) -> add 3 stops -> complete 2 stops
 *   (unlocking the "full day done" achievement) -> journal a stop with a
 *   price -> convert it to a group expense -> publish as a template ->
 *   clone from a second account (dates shifted, journals stripped) ->
 *   verify a downgraded (viewer) member's edit attempt is rejected
 *   server-side even though the client hadn't refreshed its stale UI.
 *
 * Gaps vs. the checklist found while reading the source (see the final
 * report handed back by the agent that wrote this test — not duplicated
 * here as comments beyond the two below):
 *   - There is no drag-and-drop (or any) reorder UI for agenda items, so
 *     step 2 ("reorder stops") is not exercised through the UI.
 *   - There is no UI path that ever assigns the "viewer" trip role — the
 *     invite link always joins new members as "editor" — so this test
 *     downgrades a membership directly in Postgres to construct that
 *     state, the same way a future "change member role" UI would.
 */

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function registerUser(page: Page, name: string, email: string) {
  await page.goto("/register");
  await page.fill("#name", name);
  await page.fill("#email", email);
  await page.fill("#password", "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL("/groups", { timeout: 30000 });
}

async function selectOption(page: Page, triggerSelector: string, optionName: string | RegExp) {
  await page.locator(triggerSelector).click();
  await page.getByRole("option", { name: optionName }).click();
}

test("create trip, run agenda quests, journal to expense, publish, clone, and enforce viewer role", async ({
  browser,
}, testInfo) => {
  // This journey touches more distinct first-hit (dev-mode-compiled) routes
  // across 3 separate accounts than the config's default 120s budget
  // assumes (see playwright.config.ts's comment on the smoke test's ~7
  // routes / 2 users) -- give it more headroom.
  testInfo.setTimeout(240_000);

  const stamp = Date.now();
  const ownerEmail = `trip-owner-${stamp}@example.com`;
  const joinerEmail = `trip-joiner-${stamp}@example.com`;
  const clonerEmail = `trip-cloner-${stamp}@example.com`;

  const sql = postgres(process.env.DATABASE_URL!);

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();

  await test.step("owner signs up and creates a group to link the trip to", async () => {
    await registerUser(ownerPage, "Trip Owner", ownerEmail);
    await ownerPage.fill("#name", "Trip Squad");
    await ownerPage.getByTestId("submit-create-group").click();
    await ownerPage.waitForURL(/\/groups\/[0-9a-f-]+$/, { timeout: 30000 });
  });

  let tripUrl = "";
  let tripId = "";

  await test.step("owner creates a trip linked to that group, spanning 2 days", async () => {
    await ownerPage.goto("/trips");
    await ownerPage.getByTestId("create-trip-trigger").click();
    await ownerPage.fill("#trip-title", "Siem Reap Adventure");
    await ownerPage.fill("#startDate", "2026-08-01");
    await ownerPage.fill("#endDate", "2026-08-02");
    await selectOption(ownerPage, "#groupId", "Trip Squad");
    await ownerPage.getByTestId("submit-create-trip").click();
    await ownerPage.waitForURL(/\/trips\/[0-9a-f-]+$/, { timeout: 30000 });
    tripUrl = ownerPage.url();
    tripId = tripUrl.split("/").pop()!;
  });

  await test.step("owner adds 3 stops: 2 on day 1, 1 on day 2", async () => {
    async function addStop(title: string, day: number, plannedCost: string) {
      await ownerPage.getByTestId("add-agenda-item-trigger").click();
      await ownerPage.fill("#item-title", title);
      if (day !== 1) {
        await ownerPage.locator("#dayNumber").click();
        await ownerPage.getByTestId(`day-option-${day}`).click();
      }
      await ownerPage.fill("#plannedCost", plannedCost);
      await ownerPage.getByTestId("submit-add-agenda-item").click();
      // The day's map falls back to a plain list of stop names when no
      // Google Maps key is configured, so match the actual agenda row link
      // (not the map fallback list item) to avoid ambiguity.
      await expect(ownerPage.getByRole("link", { name: title })).toBeVisible();
    }

    await addStop("Angkor Wat Sunrise", 1, "10.00");
    await addStop("Pub Street Dinner", 1, "15.00");
    await addStop("Tonle Sap Boat Tour", 2, "20.00");
  });

  function rowFor(page: Page, title: string) {
    return page.locator('[data-testid^="agenda-item-"]').filter({ hasText: title });
  }

  await test.step("complete both day-1 stops: progress/XP update and a 'full day done' achievement unlocks", async () => {
    await rowFor(ownerPage, "Angkor Wat Sunrise").getByTestId("complete-item").click();
    await expect(ownerPage.getByTestId("stops-done")).toContainText("1/3");

    // Completing the second (and last) day-1 stop finishes day 1, which is
    // exactly what src/lib/quests/achievements.ts awards "full_day_done" for.
    await rowFor(ownerPage, "Pub Street Dinner").getByTestId("complete-item").click();
    await expect(ownerPage.getByTestId("stops-done")).toContainText("2/3");
    // 2 completions (10 XP each) + the "full day done" achievement (25 XP)
    // that just unlocked = 45, per src/lib/quests/xp.ts. "XP" itself is an
    // intentionally untranslated abbreviation (see messages/*.json).
    await expect(ownerPage.getByTestId("xp-total")).toContainText("45");
    await expect(rowFor(ownerPage, "Pub Street Dinner").getByTestId("achievement-unlocked")).toBeVisible();
  });

  await test.step("journal the completed stop with a mood, text, and an actual price", async () => {
    await ownerPage.getByRole("link", { name: "Angkor Wat Sunrise" }).click();
    await ownerPage.waitForURL(/\/items\//, { timeout: 30000 });
    await ownerPage.getByRole("button", { name: "🙂" }).click();
    await ownerPage.fill("#noteText", "Gorgeous sunrise, worth the early wake-up.");
    await ownerPage.getByTestId("tag-price").click();
    await ownerPage.fill("#actualCost", "12.50");
    await ownerPage.getByTestId("submit-journal-entry").click();
    await expect(ownerPage.getByText("Gorgeous sunrise, worth the early wake-up.")).toBeVisible();
    await expect(ownerPage.getByText("$12.50")).toBeVisible();
  });

  await test.step("one tap converts the journaled price into a group expense", async () => {
    await ownerPage.getByTestId("add-to-group-expenses").click();
    await ownerPage.waitForURL(/\/groups\/.+\/expenses\/new/, { timeout: 30000 });
    await expect(ownerPage.locator("#title")).toHaveValue("Angkor Wat Sunrise");
    await expect(ownerPage.locator("#total")).toHaveValue("12.50");
    await ownerPage.getByTestId("submit-expense").click();
    await ownerPage.waitForURL(/\/groups\/[0-9a-f-]+$/, { timeout: 30000 });
    await expect(ownerPage.getByTestId("expense-title").filter({ hasText: "Angkor Wat Sunrise" })).toBeVisible();
    await expect(ownerPage.getByText("$12.50")).toBeVisible();
  });

  await test.step("owner publishes the trip as a public template", async () => {
    await ownerPage.goto(tripUrl);
    // Selected by the radio's value attribute, not its (translated) label
    // text. It's also a controlled component driven by the server action +
    // router.refresh() round trip, not a native checkbox toggle, so use a
    // plain click and let the assertion retry until the refresh lands.
    const publicTemplateRadio = ownerPage.locator('input[type="radio"][value="public_template"]');
    await publicTemplateRadio.click();
    await expect(publicTemplateRadio).toBeChecked();
  });

  await test.step("a second account clones the published trip with a new start date", async () => {
    const clonerContext = await browser.newContext();
    const clonerPage = await clonerContext.newPage();
    await registerUser(clonerPage, "Trip Cloner", clonerEmail);

    await clonerPage.goto(tripUrl);
    await clonerPage.getByTestId("use-this-template").click();
    await clonerPage.fill("#newStartDate", "2026-09-10");
    await clonerPage.getByTestId("submit-clone-trip").click();
    // We start this step already on /trips/<tripId>, which itself matches
    // a bare /\/trips\/[0-9a-f-]+$/ pattern -- wait specifically for the
    // URL to move to a *different* trip id, not just any trip URL.
    await clonerPage.waitForURL(
      (url) => /\/trips\/[0-9a-f-]+$/.test(url.pathname) && !url.pathname.endsWith(tripId),
      { timeout: 30000 },
    );
    const clonedUrl = clonerPage.url();
    const clonedTripId = clonedUrl.split("/").pop()!;

    // Dates shifted to the chosen start date (asserted against the DB
    // rather than parsing toLocaleDateString(), whose format is
    // locale-dependent): same 1-day span as the original (Aug 1 -> Aug 2),
    // shifted to Sep 10 -> Sep 11.
    // Format server-side with to_char to sidestep any JS Date/timezone
    // parsing ambiguity around DATE columns.
    const [clonedDates] = await sql`
      select to_char(start_date, 'YYYY-MM-DD') as start_date,
             to_char(end_date, 'YYYY-MM-DD') as end_date
      from trips where id = ${clonedTripId}
    `;
    expect(clonedDates.start_date).toBe("2026-09-10");
    expect(clonedDates.end_date).toBe("2026-09-11");

    // Structure carried over...
    await expect(clonerPage.getByRole("link", { name: "Angkor Wat Sunrise" })).toBeVisible();
    await expect(clonerPage.getByRole("link", { name: "Pub Street Dinner" })).toBeVisible();
    await expect(clonerPage.getByRole("link", { name: "Tonle Sap Boat Tour" })).toBeVisible();
    // ...but completion state and journals did not.
    await expect(clonerPage.getByTestId("stops-done")).toContainText("0/3");

    await clonerPage.getByRole("link", { name: "Angkor Wat Sunrise" }).click();
    await clonerPage.waitForURL(/\/items\//, { timeout: 30000 });
    await expect(clonerPage.getByTestId("no-journal-entries")).toBeVisible();
    // Clone isn't linked to a group, so there is nothing to journal-to-expense yet.
    await expect(clonerPage.getByTestId("add-to-group-expenses")).toHaveCount(0);

    const [clonedRow] = await sql`select group_id from trips where id = ${clonedTripId}`;
    expect(clonedRow.group_id).toBeNull();

    await clonerContext.close();
  });

  await test.step("a joiner is downgraded to viewer: the client is stale, but the server still rejects the mutation", async () => {
    const joinerContext = await browser.newContext();
    const joinerPage = await joinerContext.newPage();
    await registerUser(joinerPage, "Trip Joiner", joinerEmail);

    const inviteUrl = `/trips/join/${await sql`select invite_code from trips where id = ${tripId}`.then(
      (r) => r[0].invite_code,
    )}`;
    await joinerPage.goto(inviteUrl);
    await joinerPage.waitForURL(new RegExp(`/trips/${tripId}$`), { timeout: 30000 });

    // Joining via invite link always grants "editor" (the app has no UI to
    // invite as "viewer" specifically) -- confirm the editor affordances
    // are present before we downgrade the role underneath this same page.
    await expect(joinerPage.getByTestId("add-agenda-item-trigger")).toBeVisible();
    const boatRow = rowFor(joinerPage, "Tonle Sap Boat Tour");
    await expect(boatRow.getByTestId("complete-item")).toBeVisible();

    // Simulate the role being changed elsewhere (no such UI exists to drive
    // this from the app itself) without reloading the joiner's page, so the
    // already-rendered "Complete" button is now stale relative to the DB.
    await sql`
      update trip_members set role = 'viewer'
      where trip_id = ${tripId}
        and user_id = (select id from users where email = ${joinerEmail})
    `;

    // The stale client still shows (and lets you click) the Complete
    // button, but src/lib/actions/agenda-items.ts re-checks the role from
    // the DB on every call -- this must be rejected despite the client
    // allowing the click.
    await boatRow.getByTestId("complete-item").click();
    await joinerPage.waitForTimeout(1000);

    const [afterClick] = await sql`
      select status from agenda_items where trip_id = ${tripId} and title = 'Tonle Sap Boat Tour'
    `;
    expect(afterClick.status).toBe("todo");

    // Reloading picks up the real (now viewer) role: the edit/complete
    // affordances disappear entirely, matching canEditTrip/canCompleteItems.
    await joinerPage.reload();
    await expect(joinerPage.getByTestId("add-agenda-item-trigger")).toHaveCount(0);
    await expect(rowFor(joinerPage, "Tonle Sap Boat Tour").getByTestId("complete-item")).toHaveCount(0);
    // Viewers can still journal -- canJournal(role) allows "viewer" too.
    await joinerPage.getByRole("link", { name: "Tonle Sap Boat Tour" }).click();
    await joinerPage.waitForURL(/\/items\//, { timeout: 30000 });
    await expect(joinerPage.getByTestId("submit-journal-entry")).toBeVisible();

    await joinerContext.close();
  });

  await ownerContext.close();
  await sql.end();
});
