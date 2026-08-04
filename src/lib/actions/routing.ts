"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agendaItems, routeCache, trips } from "@/db/schema";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getTripRole } from "@/lib/actions/trip-membership";
import { fetchRoute, roundForCache, type Route } from "@/lib/routing/ors";
import type { LatLng } from "@/lib/trips/geo";
import { getDayRoutesSchema } from "@/lib/validation/routing";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** One agenda leg; `route` is null when routing failed for just this leg
 * (the UI draws that leg as a straight segment). */
export interface DayRouteLeg {
  fromId: string;
  toId: string;
  route: Route | null;
}

/**
 * Road routes between a day's consecutive stops, cache-first. Routes
 * between fixed points are static, so cache rows never expire — the ORS
 * free-tier quota only pays per *edited* leg, not per view.
 *
 * Returns `legs: null` when no OPENROUTESERVICE_API_KEY is configured —
 * the day map then keeps today's straight polylines (the standard
 * optional-service degradation).
 */
export async function getDayRoutes(
  input: unknown,
): Promise<ActionResult<{ legs: DayRouteLeg[] | null }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = getDayRoutesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }
  const { tripId, dayNumber, profile } = parsed.data;

  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
  if (!trip) return { ok: false, error: "Trip not found." };
  const role = await getTripRole(tripId, session.user.id);
  if (!role && trip.visibility === "private") {
    return { ok: false, error: "You don't have access to this trip." };
  }

  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey) return { ok: true, data: { legs: null } };

  if (!checkRateLimit(`routing:${session.user.id}`, 30, 5 * 60 * 1000)) {
    return { ok: false, error: "Too many route lookups — try again in a few minutes." };
  }

  const items = await db
    .select()
    .from(agendaItems)
    .where(and(eq(agendaItems.tripId, tripId), eq(agendaItems.dayNumber, dayNumber)));
  items.sort((a, b) => a.sortOrder - b.sortOrder);
  const stops = items.filter(
    (i): i is typeof i & { lat: number; lng: number } => i.lat != null && i.lng != null,
  );

  const legs: DayRouteLeg[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const from = roundForCache({ lat: stops[i].lat, lng: stops[i].lng });
    const to = roundForCache({ lat: stops[i + 1].lat, lng: stops[i + 1].lng });
    legs.push({
      fromId: stops[i].id,
      toId: stops[i + 1].id,
      route: await cachedRoute(from, to, profile, apiKey),
    });
  }

  return { ok: true, data: { legs } };
}

async function cachedRoute(
  from: LatLng,
  to: LatLng,
  profile: string,
  apiKey: string,
): Promise<Route | null> {
  const [cached] = await db
    .select()
    .from(routeCache)
    .where(
      and(
        eq(routeCache.fromLat, from.lat),
        eq(routeCache.fromLng, from.lng),
        eq(routeCache.toLat, to.lat),
        eq(routeCache.toLng, to.lng),
        eq(routeCache.profile, profile),
      ),
    )
    .limit(1);
  if (cached) {
    return {
      points: cached.polyline as LatLng[],
      distanceMeters: cached.distanceMeters,
      durationSec: cached.durationSec,
    };
  }

  let route: Route;
  try {
    route = await fetchRoute(from, to, profile as "driving-car", apiKey);
  } catch {
    // Per-leg failure (quota, unroutable pair) — this leg falls back to a
    // straight segment; other legs still render as roads.
    return null;
  }

  await db
    .insert(routeCache)
    .values({
      fromLat: from.lat,
      fromLng: from.lng,
      toLat: to.lat,
      toLng: to.lng,
      profile,
      polyline: route.points,
      distanceMeters: route.distanceMeters,
      durationSec: route.durationSec,
    })
    .onConflictDoUpdate({
      target: [
        routeCache.fromLat,
        routeCache.fromLng,
        routeCache.toLat,
        routeCache.toLng,
        routeCache.profile,
      ],
      set: {
        polyline: route.points,
        distanceMeters: route.distanceMeters,
        durationSec: route.durationSec,
        fetchedAt: new Date(),
      },
    });

  return route;
}
