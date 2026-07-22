"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { agendaItems } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getTripRole } from "@/lib/actions/trip-membership";
import { canCompleteItems, canEditTrip } from "@/lib/trips/permissions";
import { evaluateAchievements } from "@/lib/quests/achievements";
import { awardAchievements, buildAchievementContext } from "@/lib/queries/trip-achievements";
import {
  addAgendaItemSchema,
  completeAgendaItemSchema,
  reorderAgendaItemsSchema,
  resetAgendaItemSchema,
  skipAgendaItemSchema,
  updateAgendaItemSchema,
} from "@/lib/validation/agenda-items";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function addAgendaItem(
  input: unknown,
): Promise<ActionResult<{ itemId: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = addAgendaItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid item." };
  }
  const data = parsed.data;

  const role = await getTripRole(data.tripId, session.user.id);
  if (!canEditTrip(role)) return { ok: false, error: "You can't edit this trip." };

  const siblings = await db
    .select({ sortOrder: agendaItems.sortOrder })
    .from(agendaItems)
    .where(and(eq(agendaItems.tripId, data.tripId), eq(agendaItems.dayNumber, data.dayNumber)));
  const nextSortOrder = siblings.length
    ? Math.max(...siblings.map((s) => s.sortOrder)) + 1
    : 0;

  const [row] = await db
    .insert(agendaItems)
    .values({
      tripId: data.tripId,
      dayNumber: data.dayNumber,
      sortOrder: nextSortOrder,
      title: data.title,
      category: data.category,
      plannedStart: data.plannedStart,
      plannedEnd: data.plannedEnd,
      plannedCostCents: data.plannedCostCents,
      currency: data.currency,
      placeName: data.placeName,
      placeId: data.placeId,
      lat: data.lat,
      lng: data.lng,
      address: data.address,
    })
    .returning({ id: agendaItems.id });

  revalidatePath(`/trips/${data.tripId}`);
  return { ok: true, data: { itemId: row.id } };
}

export async function updateAgendaItem(input: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = updateAgendaItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid item." };
  }
  const data = parsed.data;

  const role = await getTripRole(data.tripId, session.user.id);
  if (!canEditTrip(role)) return { ok: false, error: "You can't edit this trip." };

  await db
    .update(agendaItems)
    .set({
      dayNumber: data.dayNumber,
      title: data.title,
      category: data.category,
      plannedStart: data.plannedStart,
      plannedEnd: data.plannedEnd,
      plannedCostCents: data.plannedCostCents,
      currency: data.currency,
      placeName: data.placeName,
      placeId: data.placeId,
      lat: data.lat,
      lng: data.lng,
      address: data.address,
    })
    .where(and(eq(agendaItems.id, data.itemId), eq(agendaItems.tripId, data.tripId)));

  revalidatePath(`/trips/${data.tripId}`);
  return { ok: true, data: undefined };
}

export async function reorderAgendaItems(input: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = reorderAgendaItemsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { tripId, dayNumber, orderedItemIds } = parsed.data;

  const role = await getTripRole(tripId, session.user.id);
  if (!canEditTrip(role)) return { ok: false, error: "You can't edit this trip." };

  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedItemIds.length; i++) {
      await tx
        .update(agendaItems)
        .set({ sortOrder: i })
        .where(
          and(
            eq(agendaItems.id, orderedItemIds[i]),
            eq(agendaItems.tripId, tripId),
            eq(agendaItems.dayNumber, dayNumber),
          ),
        );
    }
  });

  revalidatePath(`/trips/${tripId}`);
  return { ok: true, data: undefined };
}

async function setItemStatus(
  itemId: string,
  status: "todo" | "done" | "skipped",
  userId: string,
): Promise<ActionResult<{ unlockedAchievements: string[] }>> {
  const [item] = await db
    .select()
    .from(agendaItems)
    .where(eq(agendaItems.id, itemId))
    .limit(1);
  if (!item) return { ok: false, error: "Stop not found." };

  const role = await getTripRole(item.tripId, userId);
  if (!canCompleteItems(role)) return { ok: false, error: "You can't update this trip." };

  await db
    .update(agendaItems)
    .set({
      status,
      completedAt: status === "done" ? new Date() : null,
      completedBy: status === "done" ? userId : null,
    })
    .where(eq(agendaItems.id, itemId));

  if (status !== "done") {
    revalidatePath(`/trips/${item.tripId}`);
    return { ok: true, data: { unlockedAchievements: [] } };
  }

  const context = await buildAchievementContext(item.tripId, userId);
  const unlocked = evaluateAchievements(context);
  if (unlocked.length > 0) {
    await awardAchievements(userId, unlocked);
  }

  revalidatePath(`/trips/${item.tripId}`);
  return { ok: true, data: { unlockedAchievements: unlocked } };
}

export async function completeAgendaItem(
  input: unknown,
): Promise<ActionResult<{ unlockedAchievements: string[] }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const parsed = completeAgendaItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  return setItemStatus(parsed.data.itemId, "done", session.user.id);
}

export async function skipAgendaItem(
  input: unknown,
): Promise<ActionResult<{ unlockedAchievements: string[] }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const parsed = skipAgendaItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  return setItemStatus(parsed.data.itemId, "skipped", session.user.id);
}

export async function resetAgendaItem(
  input: unknown,
): Promise<ActionResult<{ unlockedAchievements: string[] }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const parsed = resetAgendaItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  return setItemStatus(parsed.data.itemId, "todo", session.user.id);
}
