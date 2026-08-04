/**
 * Trip-essentials lookup via the OpenStreetMap Overpass API.
 *
 * Query building and response normalization are pure (tested); only
 * `fetchNearbyPlaces` talks to the network. Results are OSM data —
 * © OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright).
 */

export const PLACE_CATEGORIES = [
  "toilets",
  "parking",
  "food",
  "market",
  "fuel",
  "atm",
  "pharmacy",
] as const;

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

/** Default search radius around the position, in meters. */
export const DEFAULT_RADIUS_METERS = 2_000;

/** Max elements requested per query — keeps responses and cache rows small. */
const MAX_RESULTS = 40;

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

/** Overpass tag selectors per category (applied to nodes, ways, relations). */
const CATEGORY_SELECTORS: Record<PlaceCategory, string[]> = {
  toilets: ['["amenity"="toilets"]'],
  parking: ['["amenity"="parking"]'],
  food: ['["amenity"~"^(restaurant|food_court)$"]', '["shop"="convenience"]'],
  market: ['["amenity"="marketplace"]'],
  fuel: ['["amenity"="fuel"]'],
  atm: ['["amenity"="atm"]'],
  pharmacy: ['["amenity"="pharmacy"]'],
};

/** The tag keys we keep on normalized places (a display-relevant subset). */
const KEPT_TAG_KEYS = [
  "name",
  "name:km",
  "name:en",
  "amenity",
  "shop",
  "brand",
  "operator",
  "opening_hours",
  "fee",
] as const;

export interface NearbyPlace {
  /** Stable id: OSM element type + id, e.g. "node/123456". */
  id: string;
  /** Display name: prefers `name:km`, then `name`; null when unnamed. */
  name: string | null;
  lat: number;
  lng: number;
  category: PlaceCategory;
  /** Subset of the OSM tags (see KEPT_TAG_KEYS). */
  tags: Record<string, string>;
}

/**
 * Overpass QL for one category around a point. `nwr` covers nodes, ways and
 * relations; `out center` adds a center point for ways/relations.
 */
export function buildOverpassQuery(
  lat: number,
  lng: number,
  category: PlaceCategory,
  radiusMeters: number = DEFAULT_RADIUS_METERS,
): string {
  const around = `(around:${radiusMeters},${lat},${lng})`;
  const selectors = CATEGORY_SELECTORS[category]
    .map((selector) => `  nwr${selector}${around};`)
    .join("\n");
  return `[out:json][timeout:25];\n(\n${selectors}\n);\nout center ${MAX_RESULTS};`;
}

interface OverpassElement {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

/** Normalize a raw Overpass JSON response into `NearbyPlace[]`. */
export function normalizeOverpassResponse(
  response: unknown,
  category: PlaceCategory,
): NearbyPlace[] {
  const elements =
    typeof response === "object" &&
    response !== null &&
    Array.isArray((response as { elements?: unknown }).elements)
      ? ((response as { elements: unknown[] }).elements as OverpassElement[])
      : [];

  const places: NearbyPlace[] = [];
  for (const el of elements) {
    if (typeof el?.type !== "string" || typeof el?.id !== "number") continue;
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (typeof lat !== "number" || typeof lng !== "number") continue;

    const tags: Record<string, string> = {};
    for (const key of KEPT_TAG_KEYS) {
      const value = el.tags?.[key];
      if (typeof value === "string" && value.length > 0) tags[key] = value;
    }

    places.push({
      id: `${el.type}/${el.id}`,
      name: tags["name:km"] ?? tags["name"] ?? null,
      lat,
      lng,
      category,
      tags,
    });
  }
  return places;
}

/**
 * Fetch nearby places for one category from the public Overpass endpoint.
 * Callers must cache (see `place_cache`) — the endpoint is shared and
 * rate-limited. Throws on network/HTTP errors; the server action maps that
 * to a friendly `{ ok: false }`.
 */
export async function fetchNearbyPlaces(
  lat: number,
  lng: number,
  category: PlaceCategory,
  radiusMeters: number = DEFAULT_RADIUS_METERS,
): Promise<NearbyPlace[]> {
  const response = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // Overpass usage policy asks for an identifying User-Agent.
      "User-Agent": "Tesajor/0.1 (trip companion; https://github.com/lymakara-dev)",
    },
    body: `data=${encodeURIComponent(buildOverpassQuery(lat, lng, category, radiusMeters))}`,
  });
  if (!response.ok) {
    throw new Error(`Overpass request failed with status ${response.status}`);
  }
  return normalizeOverpassResponse(await response.json(), category);
}
