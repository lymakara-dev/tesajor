import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // All specs register users from the same localhost IP, which shares one
  // rate-limit bucket (5 registrations / 15 min — see checkRateLimit in
  // src/lib/actions/auth.ts) across the whole run. Parallel workers made
  // that bucket fill up across files and fail unrelated tests with a
  // register timeout, not an app bug — force one worker so runs are
  // deterministic.
  workers: 1,
  retries: 0,
  reporter: "list",
  // Next.js dev mode compiles each route on first hit, which can be slow
  // on a cold server — this test visits ~7 distinct routes across 2 users.
  timeout: 120_000,
  expect: {
    // Next.js dev mode compiles routes on first hit, which can be slow
    // the first time a route is exercised — give assertions headroom.
    timeout: 10_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
