import { describe, expect, it } from "vitest";
import { computeXp } from "./xp";

describe("computeXp", () => {
  it("computes XP purely from counts, not client input", () => {
    const result = computeXp(4, 2);
    expect(result).toEqual({ totalXp: 4 * 10 + 2 * 25, fromCompletions: 40, fromAchievements: 50 });
  });

  it("is zero with no completions or achievements", () => {
    expect(computeXp(0, 0)).toEqual({ totalXp: 0, fromCompletions: 0, fromAchievements: 0 });
  });
});
