"use server";

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { agendaItems, trips, tripMembers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getTripRole } from "@/lib/actions/trip-membership";
import { canManageTrip } from "@/lib/trips/permissions";
import { cloneTripStructure } from "@/lib/trips/clone";
import { awardAchievements } from "@/lib/queries/trip-achievements";
import {
  cloneTripSchema,
  createTripSchema,
  joinTripSchema,
  publishTripSchema,
} from "@/lib/validation/trips";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function createTrip(
  input: unknown,
): Promise<ActionResult<{ tripId: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = createTripSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid trip." };
  }
  const data = parsed.data;

  const existingTrips = await db
    .select({ id: trips.id })
    .from(trips)
    .where(eq(trips.ownerId, session.user.id));
  const isUsersFirstTrip = existingTrips.length === 0;

  const tripId = await db.transaction(async (tx) => {
    const [trip] = await tx
      .insert(trips)
      .values({
        groupId: data.groupId,
        ownerId: session.user.id,
        title: data.title,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        baseCurrency: data.baseCurrency,
        inviteCode: nanoid(10),
      })
      .returning({ id: trips.id });

    await tx.insert(tripMembers).values({
      tripId: trip.id,
      userId: session.user.id,
      role: "owner",
    });

    return trip.id;
  });

  if (isUsersFirstTrip) {
    await awardAchievements(session.user.id, ["first_trip"]);
  }

  revalidatePath("/trips");
  return { ok: true, data: { tripId } };
}

export async function joinTripByInviteCode(
  input: unknown,
): Promise<ActionResult<{ tripId: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = joinTripSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid invite code." };
  }

  const [trip] = await db
    .select({ id: trips.id })
    .from(trips)
    .where(eq(trips.inviteCode, parsed.data.inviteCode))
    .limit(1);
  if (!trip) return { ok: false, error: "Invite code not found." };

  const existingRole = await getTripRole(trip.id, session.user.id);
  if (existingRole) return { ok: true, data: { tripId: trip.id } };

  await db.insert(tripMembers).values({
    tripId: trip.id,
    userId: session.user.id,
    role: "editor",
  });

  return { ok: true, data: { tripId: trip.id } };
}

export async function publishTrip(input: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = publishTripSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const role = await getTripRole(parsed.data.tripId, session.user.id);
  if (!canManageTrip(role)) {
    return { ok: false, error: "Only the trip owner can change visibility." };
  }

  await db
    .update(trips)
    .set({ visibility: parsed.data.visibility })
    .where(eq(trips.id, parsed.data.tripId));

  revalidatePath(`/trips/${parsed.data.tripId}`);
  return { ok: true, data: undefined };
}

export async function cloneTrip(
  input: unknown,
): Promise<ActionResult<{ tripId: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = cloneTripSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const [sourceTrip] = await db
    .select()
    .from(trips)
    .where(eq(trips.id, parsed.data.tripId))
    .limit(1);
  if (!sourceTrip) return { ok: false, error: "Trip not found." };

  const requesterRole = await getTripRole(sourceTrip.id, session.user.id);
  if (sourceTrip.visibility === "private" && !requesterRole) {
    return { ok: false, error: "This trip isn't shared for cloning." };
  }

  const sourceItems = await db
    .select()
    .from(agendaItems)
    .where(eq(agendaItems.tripId, sourceTrip.id));

  const cloned = cloneTripStructure({
    originalStartDate: sourceTrip.startDate,
    originalEndDate: sourceTrip.endDate,
    newStartDate: parsed.data.newStartDate,
    items: sourceItems.map((i) => ({
      dayNumber: i.dayNumber,
      sortOrder: i.sortOrder,
      title: i.title,
      category: i.category,
      plannedStart: i.plannedStart,
      plannedEnd: i.plannedEnd,
      plannedCostCents: i.plannedCostCents,
      currency: i.currency,
      placeName: i.placeName,
      placeId: i.placeId,
      lat: i.lat,
      lng: i.lng,
      address: i.address,
    })),
  });

  const existingTrips = await db
    .select({ id: trips.id })
    .from(trips)
    .where(eq(trips.ownerId, session.user.id));
  const isUsersFirstTrip = existingTrips.length === 0;

  const newTripId = await db.transaction(async (tx) => {
    const [newTrip] = await tx
      .insert(trips)
      .values({
        ownerId: session.user.id,
        title: sourceTrip.title,
        description: sourceTrip.description,
        startDate: parsed.data.newStartDate,
        endDate: cloned.newEndDate,
        baseCurrency: sourceTrip.baseCurrency,
        inviteCode: nanoid(10),
        clonedFromTripId: sourceTrip.id,
      })
      .returning({ id: trips.id });

    await tx.insert(tripMembers).values({
      tripId: newTrip.id,
      userId: session.user.id,
      role: "owner",
    });

    if (cloned.items.length > 0) {
      await tx.insert(agendaItems).values(
        cloned.items.map((item) => ({
          tripId: newTrip.id,
          dayNumber: item.dayNumber,
          sortOrder: item.sortOrder,
          title: item.title,
          category: item.category as (typeof agendaItems.$inferInsert)["category"],
          plannedStart: item.plannedStart,
          plannedEnd: item.plannedEnd,
          plannedCostCents: item.plannedCostCents,
          currency: item.currency,
          placeName: item.placeName,
          placeId: item.placeId,
          lat: item.lat,
          lng: item.lng,
          address: item.address,
        })),
      );
    }

    return newTrip.id;
  });

  if (isUsersFirstTrip) {
    await awardAchievements(session.user.id, ["first_trip"]);
  }

  revalidatePath("/trips");
  return { ok: true, data: { tripId: newTripId } };
}
