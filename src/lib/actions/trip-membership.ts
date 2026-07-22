import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tripMembers } from "@/db/schema";
import type { TripRole } from "@/lib/trips/permissions";

export async function getTripRole(
  tripId: string,
  userId: string,
): Promise<TripRole | undefined> {
  const [membership] = await db
    .select({ role: tripMembers.role })
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)))
    .limit(1);
  return membership?.role;
}
