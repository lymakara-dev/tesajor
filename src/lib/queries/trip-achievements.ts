import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { achievements, agendaItems, itemNotes } from "@/db/schema";
import type { AchievementContext, AchievementItemState } from "@/lib/quests/achievements";

/**
 * Builds achievement-evaluation context from current trip state. Always
 * passes `isUsersFirstTrip: false` — that flag only matters at trip
 * creation time and is awarded there directly.
 */
export async function buildAchievementContext(
  tripId: string,
  userId: string,
): Promise<AchievementContext> {
  const items = await db.select().from(agendaItems).where(eq(agendaItems.tripId, tripId));
  const itemStates: AchievementItemState[] = items.map((i) => ({
    id: i.id,
    dayNumber: i.dayNumber,
    status: i.status,
    completedAt: i.completedAt,
  }));

  const noteRows = items.length
    ? await db
        .select({ agendaItemId: itemNotes.agendaItemId })
        .from(itemNotes)
        .where(
          inArray(
            itemNotes.agendaItemId,
            items.map((i) => i.id),
          ),
        )
    : [];
  const notedItemIds = new Set(noteRows.map((n) => n.agendaItemId));

  const earnedRows = await db
    .select({ key: achievements.key })
    .from(achievements)
    .where(eq(achievements.userId, userId));
  const alreadyEarnedKeys = new Set(earnedRows.map((r) => r.key));

  return { tripId, items: itemStates, notedItemIds, isUsersFirstTrip: false, alreadyEarnedKeys };
}

export async function awardAchievements(userId: string, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await db
    .insert(achievements)
    .values(keys.map((key) => ({ userId, key })))
    .onConflictDoNothing();
}
