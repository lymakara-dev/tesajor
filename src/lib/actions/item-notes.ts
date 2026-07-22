"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { agendaItems, itemNotes } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getTripRole } from "@/lib/actions/trip-membership";
import { canJournal } from "@/lib/trips/permissions";
import { evaluateAchievements } from "@/lib/quests/achievements";
import { awardAchievements, buildAchievementContext } from "@/lib/queries/trip-achievements";
import { addItemNoteSchema } from "@/lib/validation/item-notes";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function addItemNote(
  input: unknown,
): Promise<ActionResult<{ noteId: string; unlockedAchievements: string[] }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = addItemNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid note." };
  }
  const data = parsed.data;

  const [item] = await db
    .select()
    .from(agendaItems)
    .where(eq(agendaItems.id, data.agendaItemId))
    .limit(1);
  if (!item) return { ok: false, error: "Stop not found." };

  const role = await getTripRole(item.tripId, session.user.id);
  if (!canJournal(role)) return { ok: false, error: "You're not a member of this trip." };

  const [row] = await db
    .insert(itemNotes)
    .values({
      agendaItemId: data.agendaItemId,
      authorId: session.user.id,
      mood: data.mood,
      noteText: data.noteText,
      tags: data.tags,
      actualCostCents: data.actualCostCents,
      photoUrls: data.photoUrls,
    })
    .returning({ id: itemNotes.id });

  const context = await buildAchievementContext(item.tripId, session.user.id);
  const unlocked = evaluateAchievements(context);
  if (unlocked.length > 0) {
    await awardAchievements(session.user.id, unlocked);
  }

  revalidatePath(`/trips/${item.tripId}`);
  return { ok: true, data: { noteId: row.id, unlockedAchievements: unlocked } };
}
