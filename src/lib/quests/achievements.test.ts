import { describe, expect, it } from "vitest";
import { evaluateAchievements, type AchievementItemState } from "./achievements";

const TRIP_ID = "trip-1";

function ctx(overrides: Partial<Parameters<typeof evaluateAchievements>[0]> = {}) {
  return {
    tripId: TRIP_ID,
    items: [] as AchievementItemState[],
    notedItemIds: new Set<string>(),
    isUsersFirstTrip: false,
    alreadyEarnedKeys: new Set<string>(),
    ...overrides,
  };
}

describe("evaluateAchievements", () => {
  it("awards first_trip when it's the user's first trip", () => {
    const unlocked = evaluateAchievements(ctx({ isUsersFirstTrip: true }));
    expect(unlocked).toContain("first_trip");
  });

  it("does not re-award first_trip if already earned", () => {
    const unlocked = evaluateAchievements(
      ctx({ isUsersFirstTrip: true, alreadyEarnedKeys: new Set(["first_trip"]) }),
    );
    expect(unlocked).not.toContain("first_trip");
  });

  it("awards full_day_done when every item in a day is done", () => {
    const items: AchievementItemState[] = [
      { id: "1", dayNumber: 1, status: "done", completedAt: new Date("2026-01-01T12:00:00") },
      { id: "2", dayNumber: 1, status: "done", completedAt: new Date("2026-01-01T13:00:00") },
    ];
    const unlocked = evaluateAchievements(ctx({ items }));
    expect(unlocked).toContain(`full_day_done:${TRIP_ID}:1`);
  });

  it("does not award full_day_done if any item in the day is not done", () => {
    const items: AchievementItemState[] = [
      { id: "1", dayNumber: 1, status: "done", completedAt: new Date() },
      { id: "2", dayNumber: 1, status: "todo", completedAt: null },
    ];
    const unlocked = evaluateAchievements(ctx({ items }));
    expect(unlocked).not.toContain(`full_day_done:${TRIP_ID}:1`);
  });

  it("skipped items block full_day_done (must be genuinely done, not just handled)", () => {
    const items: AchievementItemState[] = [
      { id: "1", dayNumber: 1, status: "done", completedAt: new Date() },
      { id: "2", dayNumber: 1, status: "skipped", completedAt: null },
    ];
    const unlocked = evaluateAchievements(ctx({ items }));
    expect(unlocked).not.toContain(`full_day_done:${TRIP_ID}:1`);
  });

  it("awards day_streak_3 for 3 consecutive fully-done days", () => {
    const items: AchievementItemState[] = [1, 2, 3].map((day) => ({
      id: `item-${day}`,
      dayNumber: day,
      status: "done",
      completedAt: new Date("2026-01-01T12:00:00"),
    }));
    const unlocked = evaluateAchievements(ctx({ items }));
    expect(unlocked).toContain(`day_streak_3:${TRIP_ID}`);
  });

  it("does not award day_streak_3 when there's a gap", () => {
    const items: AchievementItemState[] = [
      { id: "1", dayNumber: 1, status: "done", completedAt: new Date() },
      { id: "2", dayNumber: 2, status: "todo", completedAt: null },
      { id: "3", dayNumber: 3, status: "done", completedAt: new Date() },
    ];
    const unlocked = evaluateAchievements(ctx({ items }));
    expect(unlocked).not.toContain(`day_streak_3:${TRIP_ID}`);
  });

  it("awards all_stops_done only when every item in the whole trip is done", () => {
    const items: AchievementItemState[] = [
      { id: "1", dayNumber: 1, status: "done", completedAt: new Date() },
      { id: "2", dayNumber: 2, status: "done", completedAt: new Date() },
    ];
    expect(evaluateAchievements(ctx({ items }))).toContain(`all_stops_done:${TRIP_ID}`);

    const withSkip = [...items, { id: "3", dayNumber: 3, status: "skipped" as const, completedAt: null }];
    expect(evaluateAchievements(ctx({ items: withSkip }))).not.toContain(`all_stops_done:${TRIP_ID}`);
  });

  it("awards journaled_every_stop only when every done item has a note", () => {
    const items: AchievementItemState[] = [
      { id: "1", dayNumber: 1, status: "done", completedAt: new Date() },
      { id: "2", dayNumber: 1, status: "done", completedAt: new Date() },
    ];
    const withAllNoted = evaluateAchievements(
      ctx({ items, notedItemIds: new Set(["1", "2"]) }),
    );
    expect(withAllNoted).toContain(`journaled_every_stop:${TRIP_ID}`);

    const withPartialNoted = evaluateAchievements(
      ctx({ items, notedItemIds: new Set(["1"]) }),
    );
    expect(withPartialNoted).not.toContain(`journaled_every_stop:${TRIP_ID}`);
  });

  it("awards early_bird when a stop is completed before 9am", () => {
    const items: AchievementItemState[] = [
      { id: "1", dayNumber: 1, status: "done", completedAt: new Date("2026-01-01T07:30:00") },
    ];
    expect(evaluateAchievements(ctx({ items }))).toContain(`early_bird:${TRIP_ID}`);
  });

  it("does not award early_bird for a stop completed later in the day", () => {
    const items: AchievementItemState[] = [
      { id: "1", dayNumber: 1, status: "done", completedAt: new Date("2026-01-01T14:00:00") },
    ];
    expect(evaluateAchievements(ctx({ items }))).not.toContain(`early_bird:${TRIP_ID}`);
  });

  it("returns an empty array for an empty trip with no first-trip flag", () => {
    expect(evaluateAchievements(ctx())).toEqual([]);
  });

  it("never returns duplicate keys and skips already-earned ones", () => {
    const items: AchievementItemState[] = [1, 2, 3].map((day) => ({
      id: `item-${day}`,
      dayNumber: day,
      status: "done",
      completedAt: new Date("2026-01-01T12:00:00"),
    }));
    const unlocked = evaluateAchievements(
      ctx({
        items,
        alreadyEarnedKeys: new Set([`full_day_done:${TRIP_ID}:1`, `all_stops_done:${TRIP_ID}`]),
      }),
    );
    expect(unlocked).not.toContain(`full_day_done:${TRIP_ID}:1`);
    expect(unlocked).not.toContain(`all_stops_done:${TRIP_ID}`);
    expect(unlocked).toContain(`full_day_done:${TRIP_ID}:2`);
    expect(new Set(unlocked).size).toBe(unlocked.length);
  });
});
