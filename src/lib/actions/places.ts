"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { placeCache } from "@/db/schema";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { cacheCellForPoint, cellCenter } from "@/lib/places/cache-cell";
import { fetchNearbyPlaces, type NearbyPlace } from "@/lib/places/overpass";
import { haversineDistanceMeters } from "@/lib/trips/geo";
import { getNearbyPlacesSchema } from "@/lib/validation/places";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface NearbyPlaceWithDistance extends NearbyPlace {
  distanceMeters: number;
}

/** ~7 days — POIs change slowly; keeps load off the shared Overpass endpoint. */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Nearby trip essentials (toilets, parking, food, …) around a position.
 *
 * Read-only with respect to group/trip data (no membership check or
 * activity_log needed) — the only write is the shared `place_cache` table
 * of public OSM data. Cache-first per grid cell + category; Overpass is hit
 * once per cell+category per TTL window.
 */
export async function getNearbyPlaces(
  input: unknown,
): Promise<ActionResult<{ places: NearbyPlaceWithDistance[] }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = getNearbyPlacesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid search." };
  }
  const { lat, lng, category } = parsed.data;

  if (!checkRateLimit(`places:${session.user.id}`, 30, 5 * 60 * 1000)) {
    return { ok: false, error: "Too many searches — try again in a few minutes." };
  }

  const cell = cacheCellForPoint(lat, lng);

  const [cached] = await db
    .select()
    .from(placeCache)
    .where(and(eq(placeCache.cell, cell), eq(placeCache.category, category)))
    .limit(1);

  let places: NearbyPlace[];
  if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
    places = cached.resultsJson as NearbyPlace[];
  } else {
    // Query around the cell center (not the exact position) so every caller
    // in the cell shares this row; distance is still computed from the
    // caller's real position below.
    const center = cellCenter(cell) ?? { lat, lng };
    try {
      places = await fetchNearbyPlaces(center.lat, center.lng, category);
    } catch {
      return { ok: false, error: "Couldn't reach the places service — try again shortly." };
    }
    await db
      .insert(placeCache)
      .values({ cell, category, resultsJson: places, fetchedAt: new Date() })
      .onConflictDoUpdate({
        target: [placeCache.cell, placeCache.category],
        set: { resultsJson: places, fetchedAt: new Date() },
      });
  }

  const withDistance = places
    .map((place) => ({
      ...place,
      distanceMeters: Math.round(
        haversineDistanceMeters({ lat, lng }, { lat: place.lat, lng: place.lng }),
      ),
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  return { ok: true, data: { places: withDistance } };
}
