/**
 * Road-routing provider: OpenRouteService (free tier, optional
 * `OPENROUTESERVICE_API_KEY`). Request/response handling is pure and
 * unit-tested; the fetcher is a thin wrapper. The `Route` shape is
 * provider-neutral so a self-hosted OSRM driver can slot in behind the
 * same interface later (ADR-0009).
 */
import type { LatLng } from "@/lib/trips/geo";

export const ROUTING_PROFILES = ["driving-car"] as const;
export type RoutingProfile = (typeof ROUTING_PROFILES)[number];

export interface Route {
  /** Road-snapped points from start to end. */
  points: LatLng[];
  distanceMeters: number;
  durationSec: number;
}

const ORS_BASE = "https://api.openrouteservice.org/v2/directions";

export function orsUrl(profile: RoutingProfile): string {
  return `${ORS_BASE}/${profile}/geojson`;
}

/** ORS (like GeoJSON) wants [lng, lat] pairs. */
export function orsRequestBody(from: LatLng, to: LatLng): { coordinates: number[][] } {
  return {
    coordinates: [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ],
  };
}

interface OrsGeoJson {
  features?: {
    geometry?: { coordinates?: number[][] };
    properties?: { summary?: { distance?: number; duration?: number } };
  }[];
}

/** Parse an ORS GeoJSON directions response into a provider-neutral Route. */
export function parseOrsRoute(json: unknown): Route {
  const feature = (json as OrsGeoJson)?.features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  if (!coordinates || coordinates.length < 2) {
    throw new Error("No route in response");
  }
  return {
    points: coordinates.map(([lng, lat]) => ({ lat, lng })),
    distanceMeters: Math.round(feature.properties?.summary?.distance ?? 0),
    durationSec: Math.round(feature.properties?.summary?.duration ?? 0),
  };
}

/**
 * Round a coordinate for the `route_cache` key: 4 decimals ≈ 11 m, so tiny
 * pin adjustments reuse the cached route instead of spending quota.
 */
export function roundForCache(point: LatLng): LatLng {
  const round = (v: number) => Math.round(v * 10_000) / 10_000;
  return { lat: round(point.lat), lng: round(point.lng) };
}

const FETCH_TIMEOUT_MS = 10_000;

/** One routed leg from the hosted ORS API. Throws on any failure — callers
 * degrade to the straight polyline. */
export async function fetchRoute(
  from: LatLng,
  to: LatLng,
  profile: RoutingProfile,
  apiKey: string,
): Promise<Route> {
  const res = await fetch(orsUrl(profile), {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(orsRequestBody(from, to)),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Routing service returned ${res.status}`);
  return parseOrsRoute(await res.json());
}
