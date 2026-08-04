import http from "node:http";
import path from "node:path";
import dotenv from "dotenv";
import postgres from "postgres";
import { test, expect } from "@playwright/test";

/**
 * End-to-end Trip Companion journey (TC-1/2/3/4) on a mobile viewport,
 * deterministic without any external service:
 *
 *   - Explore essentials (TC-1): the Overpass response is seeded straight
 *     into `place_cache` for the test position's grid cell — the action is
 *     cache-first, so no network request ever leaves the server.
 *   - Music (TC-2): a throwaway local HTTP server speaks just enough
 *     Subsonic (ping/getPlaylists/getPlaylist/stream) for account linking,
 *     the name-match suggestion ("Phnom Penh vibes" for stops in Phnom
 *     Penh), and the mini-player queue.
 *   - Follow mode + arrival welcome (TC-3/4): Playwright's geolocation
 *     drives the position — far (next-stop card with distance), then
 *     inside the 100 m radius through the 10 s dwell (welcome banner +
 *     check-in). No ORS key is configured, so this exercises the
 *     documented straight-line fallback path.
 *   - The reminder cron route rejects unauthenticated calls.
 *
 * Test ids over UI strings throughout — the default locale is Khmer.
 */

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Wat Phnom, Phnom Penh (province KH-12 for the music name-match).
const STOP = { lat: 11.5564, lng: 104.9282 };
const NEAR = { latitude: 11.557, longitude: 104.9285 }; // ~70 m from STOP
const FAR = { latitude: 11.575, longitude: 104.935 }; // ~2 km from STOP

/** Mirror of src/lib/places/cache-cell.ts (e2e doesn't import app code). */
function cacheCell(lat: number, lng: number): string {
  return `${Math.floor(lat / 0.02)}:${Math.floor(lng / 0.02)}`;
}

const MUSIC_PORT = 45533;

function subsonicJson(body: Record<string, unknown>) {
  return JSON.stringify({ "subsonic-response": { status: "ok", ...body } });
}

function startMusicStub(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${MUSIC_PORT}`);
    const respond = (json: string) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(json);
    };
    switch (url.pathname) {
      case "/rest/ping":
        return respond(subsonicJson({}));
      case "/rest/getPlaylists":
        return respond(
          subsonicJson({
            playlists: {
              playlist: [{ id: "pl-1", name: "Phnom Penh vibes", songCount: 1, duration: 180 }],
            },
          }),
        );
      case "/rest/getPlaylist":
        return respond(
          subsonicJson({
            playlist: {
              entry: [{ id: "s-1", title: "Riverside Song", artist: "Test Artist", duration: 180 }],
            },
          }),
        );
      case "/rest/stream":
        res.writeHead(200, { "Content-Type": "audio/mpeg" });
        return res.end(Buffer.alloc(128));
      default:
        res.writeHead(404);
        return res.end();
    }
  });
  return new Promise((resolve) => server.listen(MUSIC_PORT, "127.0.0.1", () => resolve(server)));
}

test("explore essentials, music suggestion, follow mode with arrival welcome, cron guard", async ({
  browser,
}, testInfo) => {
  // Several first-hit dev-compiled routes + a real 10 s arrival dwell.
  testInfo.setTimeout(240_000);

  const stamp = Date.now();
  const email = `companion-${stamp}@example.com`;
  const sql = postgres(process.env.DATABASE_URL!);
  const musicStub = await startMusicStub();

  const context = await browser.newContext({
    geolocation: { ...NEAR, accuracy: 10 },
    permissions: ["geolocation"],
  });
  const page = await context.newPage();

  let tripUrl = "";
  let tripId = "";

  await test.step("sign up and create a 1-day trip", async () => {
    await page.goto("/register");
    await page.fill("#name", "Companion Tester");
    await page.fill("#email", email);
    await page.fill("#password", "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("/groups", { timeout: 30000 });

    const today = new Date().toISOString().slice(0, 10);
    await page.goto("/trips");
    await page.getByTestId("create-trip-trigger").click();
    await page.fill("#trip-title", "Phnom Penh Day");
    await page.fill("#startDate", today);
    await page.fill("#endDate", today);
    await page.getByTestId("submit-create-trip").click();
    await page.waitForURL(/\/trips\/[0-9a-f-]+$/, { timeout: 30000 });
    tripUrl = page.url();
    tripId = tripUrl.split("/").pop()!;
  });

  await test.step("add a stop and give it coordinates (no Places key in dev — set via DB)", async () => {
    await page.getByTestId("add-agenda-item-trigger").click();
    await page.fill("#item-title", "Wat Phnom");
    await page.getByTestId("submit-add-agenda-item").click();
    await expect(page.getByRole("link", { name: "Wat Phnom" })).toBeVisible();

    await sql`
      update agenda_items set lat = ${STOP.lat}, lng = ${STOP.lng}, place_name = 'Wat Phnom'
      where trip_id = ${tripId} and title = 'Wat Phnom'
    `;
  });

  await test.step("explore: a seeded cache cell serves nearby toilets; one tap adds to the agenda", async () => {
    const cell = cacheCell(NEAR.latitude, NEAR.longitude);
    await sql`
      insert into place_cache (cell, category, results_json)
      values (${cell}, 'toilets', ${sql.json([
        {
          id: "node/1",
          name: "Test Toilets",
          lat: 11.5572,
          lng: 104.9287,
          category: "toilets",
          tags: { amenity: "toilets" },
        },
      ])})
      on conflict (cell, category) do update set results_json = excluded.results_json,
        fetched_at = now()
    `;

    await page.goto(`/trips/${tripId}/explore`);
    await page.getByTestId("explore-category-toilets").click();
    await expect(page.getByText("Test Toilets")).toBeVisible();

    await page.getByTestId("add-place-to-agenda").click();
    await expect(page.getByTestId("add-place-to-agenda")).toBeDisabled();

    await page.goto(tripUrl);
    await expect(page.getByRole("link", { name: "Test Toilets" })).toBeVisible();
  });

  await test.step("music: link the stub Subsonic server, get the province name-match suggestion, open the mini-player", async () => {
    await page.goto("/account");
    await page.fill("#music-server-url", `http://127.0.0.1:${MUSIC_PORT}`);
    await page.fill("#music-username", "makara");
    await page.fill("#music-password", "sesame");
    await page.getByTestId("link-music-server").click();
    await expect(page.getByTestId("music-linked")).toBeVisible();

    await page.goto(tripUrl);
    // Stops are in Phnom Penh (KH-12); no explicit mapping exists, so the
    // suggestion comes from the playlist-name match rule.
    await expect(page.getByTestId("music-suggestion")).toContainText("Phnom Penh vibes");
    await page.getByTestId("music-play").click();
    await expect(page.getByTestId("mini-player")).toBeVisible();
    await expect(page.getByTestId("mini-player")).toContainText("Riverside Song");
  });

  await test.step("follow mode: next-stop card from afar, then a 10 s dwell inside 100 m fires the arrival welcome", async () => {
    await context.setGeolocation({ ...FAR, accuracy: 10 });
    await page.getByTestId("follow-toggle").click();
    await expect(page.getByTestId("follow-next-stop")).toBeVisible();
    await expect(page.getByTestId("follow-next-stop")).toContainText("Wat Phnom");

    // Enter the arrival radius; the pure state machine needs a sample after
    // the 10 s dwell, so nudge the position once the clock has passed.
    await context.setGeolocation({ ...NEAR, accuracy: 10 });
    await page.waitForTimeout(10_500);
    await context.setGeolocation({ latitude: NEAR.latitude + 0.00001, longitude: NEAR.longitude, accuracy: 10 });

    await expect(page.getByTestId("arrival-welcome")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("arrival-welcome")).toContainText("Wat Phnom");

    // Arriving, hearing the welcome, and collecting the XP are one moment:
    // the banner's check-in completes the quest.
    await page.getByTestId("arrival-complete").click();
    await expect(page.getByTestId("stops-done")).toContainText("1/2");
  });

  await test.step("the voice-reminder cron route rejects unauthenticated calls", async () => {
    const response = await page.request.get("/api/cron/voice-reminders");
    expect(response.status()).toBe(401);
  });

  await context.close();
  await new Promise((resolve) => musicStub.close(resolve));
  await sql.end();
});
