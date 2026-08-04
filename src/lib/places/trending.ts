/**
 * Trending places from public template trips.
 *
 * Pure ranking over rows the caller fetches (agenda items of
 * `public_template` trips that have coordinates). A place is identified by
 * its Google `place_id` when present, else its normalized title — the same
 * spot added across many public trips counts once per trip.
 *
 * Score = Σ over *distinct trips* of 0.5^(ageDays / halfLifeDays), so a
 * place added to many recent templates outranks one with the same count of
 * old ones. Places below `minDistinctTrips` are hidden entirely — the
 * honest cold-start rule from the plan (open question 3: ≥ 3 trips).
 */

export interface TrendingSourceRow {
  /** Google place_id when the stop has one, else null. */
  placeId: string | null;
  title: string;
  lat: number;
  lng: number;
  tripId: string;
  /** When the referencing trip was created — drives recency decay. */
  createdAt: Date;
}

export interface TrendingPlace {
  /** placeId or normalized title — stable identity for the place. */
  key: string;
  name: string;
  lat: number;
  lng: number;
  /** Number of distinct public trips referencing the place. */
  tripCount: number;
  score: number;
}

export interface TrendingOptions {
  now?: Date;
  /** Hide places referenced by fewer distinct trips than this. Default 3. */
  minDistinctTrips?: number;
  halfLifeDays?: number;
  limit?: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function placeKey(row: Pick<TrendingSourceRow, "placeId" | "title">): string {
  return row.placeId ?? `title:${row.title.trim().toLowerCase()}`;
}

export function rankTrendingPlaces(
  rows: TrendingSourceRow[],
  options: TrendingOptions = {},
): TrendingPlace[] {
  const now = options.now ?? new Date();
  const minDistinctTrips = options.minDistinctTrips ?? 3;
  const halfLifeDays = options.halfLifeDays ?? 90;
  const limit = options.limit ?? 10;

  const byKey = new Map<
    string,
    { name: string; lat: number; lng: number; tripDecays: Map<string, number> }
  >();

  for (const row of rows) {
    const key = placeKey(row);
    const ageDays = Math.max(0, (now.getTime() - row.createdAt.getTime()) / MS_PER_DAY);
    const decay = Math.pow(0.5, ageDays / halfLifeDays);

    let entry = byKey.get(key);
    if (!entry) {
      entry = { name: row.title, lat: row.lat, lng: row.lng, tripDecays: new Map() };
      byKey.set(key, entry);
    }
    // One contribution per distinct trip; keep the freshest.
    const existing = entry.tripDecays.get(row.tripId);
    if (existing === undefined || decay > existing) {
      entry.tripDecays.set(row.tripId, decay);
    }
  }

  const ranked: TrendingPlace[] = [];
  for (const [key, entry] of byKey) {
    const tripCount = entry.tripDecays.size;
    if (tripCount < minDistinctTrips) continue;
    let score = 0;
    for (const decay of entry.tripDecays.values()) score += decay;
    ranked.push({ key, name: entry.name, lat: entry.lat, lng: entry.lng, tripCount, score });
  }

  ranked.sort(
    (a, b) => b.score - a.score || b.tripCount - a.tripCount || a.name.localeCompare(b.name),
  );
  return ranked.slice(0, limit);
}
