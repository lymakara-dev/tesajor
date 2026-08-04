import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { agendaItems, trips } from "@/db/schema";
import type { TrendingSourceRow } from "@/lib/places/trending";

/**
 * Source rows for trending ranking: every located agenda item of every
 * `public_template` trip. Recency comes from the referencing trip's
 * creation date (agenda items carry no timestamp of their own).
 * Server-side only — feed the result to `rankTrendingPlaces`.
 */
export async function getTrendingSourceRows(): Promise<TrendingSourceRow[]> {
  const rows = await db
    .select({
      placeId: agendaItems.placeId,
      title: agendaItems.title,
      lat: agendaItems.lat,
      lng: agendaItems.lng,
      tripId: agendaItems.tripId,
      createdAt: trips.createdAt,
    })
    .from(agendaItems)
    .innerJoin(trips, eq(agendaItems.tripId, trips.id))
    .where(
      and(
        eq(trips.visibility, "public_template"),
        isNotNull(agendaItems.lat),
        isNotNull(agendaItems.lng),
      ),
    );

  return rows.map((row) => ({
    placeId: row.placeId,
    title: row.title,
    lat: row.lat as number,
    lng: row.lng as number,
    tripId: row.tripId,
    createdAt: row.createdAt,
  }));
}
