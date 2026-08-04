# ADR-0007: Overpass (OpenStreetMap) over Google Places for trip essentials

- **Status**: Accepted
- **Date**: 2026-07-31

## Context

The Explore tab (Trip Companion TC-1) needs nearby-POI search for practical
categories: toilets, parking, food, market, fuel, ATM, pharmacy. Options:

- **Google Places Nearby Search** — best data, but needs a billing-enabled
  key, per-request cost, and caching Google data long-term violates its ToS.
- **OpenStreetMap Overpass API** — free, keyless, cacheable (ODbL with
  attribution), decent Cambodian coverage of exactly these amenity
  categories; the public endpoint is shared and rate-limited.
- Foursquare/Mapbox POI tiers — keys + quotas, no clear win over OSM for
  Cambodian essentials.

The same phase needs "which province is this point in?"; Google offers no
free equivalent, while OSM-derived ADM1 boundaries (geoBoundaries) are
freely bundleable.

## Decision

Use Overpass (`https://overpass-api.de/api/interpreter`) as the default and
only provider for essentials, implemented in `src/lib/places/overpass.ts`
(pure query builder + normalizer, thin fetcher with an identifying
User-Agent). Respect the shared endpoint by caching every response in the
`place_cache` table keyed on ~0.02° grid cell + category
(`src/lib/places/cache-cell.ts`) with a 7-day TTL, and rate-limiting the
`getNearbyPlaces` action per user. Province lookup bundles simplified
geoBoundaries KHM ADM1 polygons in `src/lib/geo/provinces-data.ts` with
"© OpenStreetMap contributors" attribution in the app footer.

## Consequences

- Zero cost, no keys, and cache rows are legally storable — but data quality
  is whatever OSM mappers have contributed; sparse rural coverage shows up
  as honest empty states.
- The `NearbyPlace` shape is provider-neutral, so a Places-enabled Google
  key later only means a second fetcher behind the same normalized type
  (already noted in the trip-companion plan's Improvements).
- If Overpass availability becomes a problem, self-hosting an Overpass
  instance or switching mirrors is a one-line endpoint change.
