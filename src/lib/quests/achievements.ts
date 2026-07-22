export interface AchievementItemState {
  id: string;
  dayNumber: number;
  status: "todo" | "done" | "skipped";
  completedAt: Date | null;
}

export interface AchievementContext {
  tripId: string;
  items: AchievementItemState[];
  /** Item ids that have at least one journal note. */
  notedItemIds: Set<string>;
  isUsersFirstTrip: boolean;
  /** Achievement keys this user has already earned, anywhere — avoids re-awarding. */
  alreadyEarnedKeys: Set<string>;
}

/**
 * Pure achievement-unlock evaluation. Re-run this against the full current
 * trip state after every completion/journal — it naturally no-ops for
 * anything already in `alreadyEarnedKeys`, so it's safe to call repeatedly.
 *
 * "early_bird" is defined here as completing at least one stop before
 * 9am local time — the plan lists it only as an example key, so this is
 * a concrete (documented) interpretation of it.
 */
export function evaluateAchievements(ctx: AchievementContext): string[] {
  const unlocked: string[] = [];
  const award = (key: string) => {
    if (!ctx.alreadyEarnedKeys.has(key) && !unlocked.includes(key)) unlocked.push(key);
  };

  if (ctx.isUsersFirstTrip) award("first_trip");

  if (ctx.items.length === 0) return unlocked;

  const dayNumbers = [...new Set(ctx.items.map((i) => i.dayNumber))].sort((a, b) => a - b);
  const fullDays = new Set<number>();
  for (const day of dayNumbers) {
    const dayItems = ctx.items.filter((i) => i.dayNumber === day);
    if (dayItems.length > 0 && dayItems.every((i) => i.status === "done")) {
      fullDays.add(day);
      award(`full_day_done:${ctx.tripId}:${day}`);
    }
  }

  for (const day of dayNumbers) {
    if (fullDays.has(day) && fullDays.has(day + 1) && fullDays.has(day + 2)) {
      award(`day_streak_3:${ctx.tripId}`);
      break;
    }
  }

  if (ctx.items.every((i) => i.status === "done")) {
    award(`all_stops_done:${ctx.tripId}`);
  }

  const doneItems = ctx.items.filter((i) => i.status === "done");
  if (doneItems.length > 0 && doneItems.every((i) => ctx.notedItemIds.has(i.id))) {
    award(`journaled_every_stop:${ctx.tripId}`);
  }

  if (doneItems.some((i) => i.completedAt && i.completedAt.getHours() < 9)) {
    award(`early_bird:${ctx.tripId}`);
  }

  return unlocked;
}
