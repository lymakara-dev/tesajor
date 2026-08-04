# ADR-0009: OpenRouteService behind a provider-neutral routing interface

- **Status**: Accepted
- **Date**: 2026-08-04

## Context

Road routing & Follow mode (Trip Companion TC-3) needs driving routes
between agenda stops: a road-snapped polyline plus distance and duration
per leg. Options:

- **Google Directions API** — best data, but needs the paid billing-enabled
  key this project deliberately runs without (the Maps display key is
  already optional).
- **OpenRouteService hosted API** — free tier (~2 000 req/day), simple
  bearer key, OSM road data with fine Cambodian coverage; quota is tight
  only if routes are fetched per view.
- **Self-hosted OSRM** — no quota at all with the Cambodia OSM extract in
  one Docker container; fits the owner's self-hosting setup, but is an
  operational dependency the MVP doesn't need yet.

Routes between two fixed stops are effectively static, so nearly all
lookups are repeats.

## Decision

`src/lib/routing/` exposes a provider-neutral `Route` shape
(`points`, `distanceMeters`, `durationSec`); `ors.ts` is the only driver
for now (pure request/response construction + thin fetcher, tested).
`OPENROUTESERVICE_API_KEY` is optional server-side env: unset → the
`getDayRoutes` action returns `legs: null` and the day map keeps the
straight polylines (the house optional-service pattern). Every fetched leg
is cached forever in `route_cache`, keyed on coordinates rounded to ~10 m
(`roundForCache`) + profile, so the free-tier quota pays only per *edited*
leg. Follow-mode geometry (`follow.ts`: nearest-point-on-polyline,
remaining distance, ETA, 200 m off-route detection) is pure and
provider-independent — it works even on straight-line fallback legs
(distance only, no ETA).

## Consequences

- Zero mandatory cost or keys; with a key, a day's routes cost one request
  per leg once, ever (until a stop moves ≥ ~10 m).
- Swapping in self-hosted OSRM (or Google Directions with a paid key) is a
  second fetcher returning the same `Route` — cache and UI untouched;
  planned in the trip-companion Improvements list alongside a moto profile.
- MVP ships `driving-car` only; ORS's cycling profile is the nearest proxy
  until a custom OSRM moto profile exists (open question 2 in the plan).
- Voice turn-by-turn stays out of scope — the universal Google Maps
  "Navigate" handoff remains the way to actually drive a leg.
