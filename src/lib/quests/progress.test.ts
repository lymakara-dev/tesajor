import { describe, expect, it } from "vitest";
import { computeDayProgress, computeTripProgress } from "./progress";

const items = [
  { id: "1", dayNumber: 1, status: "done" as const },
  { id: "2", dayNumber: 1, status: "todo" as const },
  { id: "3", dayNumber: 2, status: "done" as const },
  { id: "4", dayNumber: 2, status: "skipped" as const },
];

describe("computeDayProgress", () => {
  it("counts only completed items for that day", () => {
    expect(computeDayProgress(items, 1)).toEqual({ completed: 1, total: 2, percent: 50 });
  });

  it("returns zero total for a day with no items", () => {
    expect(computeDayProgress(items, 99)).toEqual({ completed: 0, total: 0, percent: 0 });
  });

  it("skipped items count toward total but not completed", () => {
    expect(computeDayProgress(items, 2)).toEqual({ completed: 1, total: 2, percent: 50 });
  });
});

describe("computeTripProgress", () => {
  it("aggregates across all days", () => {
    expect(computeTripProgress(items)).toEqual({ completed: 2, total: 4, percent: 50 });
  });

  it("returns 100% when every item is done", () => {
    const allDone = items.map((i) => ({ ...i, status: "done" as const }));
    expect(computeTripProgress(allDone).percent).toBe(100);
  });

  it("handles an empty trip", () => {
    expect(computeTripProgress([])).toEqual({ completed: 0, total: 0, percent: 0 });
  });
});
