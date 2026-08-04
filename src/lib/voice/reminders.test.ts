import { describe, expect, it } from "vitest";
import { REMINDER_LEAD_MS, absoluteAudioUrl, isDueForReminder } from "./reminders";

const NOW = 1_760_000_000_000;
const MIN = 60_000;

describe("isDueForReminder", () => {
  it("fires inside the 15-minute window", () => {
    expect(isDueForReminder(NOW + 14 * MIN, NOW)).toBe(true);
    expect(isDueForReminder(NOW + REMINDER_LEAD_MS, NOW)).toBe(true);
  });

  it("does not fire before the window opens", () => {
    expect(isDueForReminder(NOW + 16 * MIN, NOW)).toBe(false);
  });

  it("does not fire once the start has passed", () => {
    expect(isDueForReminder(NOW, NOW)).toBe(false);
    expect(isDueForReminder(NOW - MIN, NOW)).toBe(false);
  });

  it("accepts a custom lead", () => {
    expect(isDueForReminder(NOW + 25 * MIN, NOW, 30 * MIN)).toBe(true);
    expect(isDueForReminder(NOW + 25 * MIN, NOW, 20 * MIN)).toBe(false);
  });
});

describe("absoluteAudioUrl", () => {
  it("passes absolute URLs through", () => {
    expect(absoluteAudioUrl("https://res.cloudinary.com/x/a.mp3", "https://app.example")).toBe(
      "https://res.cloudinary.com/x/a.mp3",
    );
  });

  it("prefixes app-relative upload paths with the base URL", () => {
    expect(absoluteAudioUrl("/uploads/a.mp3", "https://app.example")).toBe(
      "https://app.example/uploads/a.mp3",
    );
    expect(absoluteAudioUrl("/uploads/a.mp3", "https://app.example/")).toBe(
      "https://app.example/uploads/a.mp3",
    );
  });
});
