/**
 * Which Cambodian province is a lat/lng in?
 *
 * Pure, framework-free. Boundary polygons live in `provinces-data.ts`
 * (geoBoundaries gbOpen KHM ADM1 — OSM-derived, ODbL; see that file's
 * header for attribution and regeneration notes).
 *
 * Because each province was simplified independently, shared borders no
 * longer line up exactly: a point can fall in a thin sliver between two
 * simplified boundaries (a "gap") or inside two at once (an "overlap").
 * Both are handled:
 * - overlaps: provinces are stored smallest-area-first, so the innermost
 *   match wins (e.g. Phnom Penh, which is a hole inside Kandal);
 * - gaps: a point contained by no polygon is snapped to the province whose
 *   boundary is nearest, but only within BORDER_SNAP_METERS — far enough
 *   to swallow simplification slivers, near enough that open sea and
 *   neighboring countries still return null.
 */
import { PROVINCES, type ProvinceShape } from "./provinces-data";

export interface Province {
  /** ISO 3166-2:KH code, e.g. "KH-12". */
  code: string;
  nameEn: string;
  nameKm: string;
}

/** Cambodia bounding box (generous) — cheap early exit for far-away points. */
const KH_BBOX = { minLat: 9.2, maxLat: 14.8, minLng: 102.2, maxLng: 108.0 };

/** Max snap distance for points that fall into simplification slivers. */
const BORDER_SNAP_METERS = 2_000;

/** Meters per degree of latitude (near-constant). */
const METERS_PER_DEG_LAT = 111_320;

/**
 * Even-odd ray casting over one flat ring [lng0, lat0, lng1, lat1, ...].
 * The ring is closed (first point repeated last).
 */
function pointInRing(lat: number, lng: number, ring: number[]): boolean {
  let inside = false;
  const n = ring.length / 2;
  let j = n - 1;
  for (let i = 0; i < n; i++) {
    const xi = ring[2 * i];
    const yi = ring[2 * i + 1];
    const xj = ring[2 * j];
    const yj = ring[2 * j + 1];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
}

/** Inside the polygon's outer ring and outside all of its holes. */
function pointInPolygon(lat: number, lng: number, polygon: number[][]): boolean {
  if (!pointInRing(lat, lng, polygon[0])) return false;
  for (let h = 1; h < polygon.length; h++) {
    if (pointInRing(lat, lng, polygon[h])) return false;
  }
  return true;
}

/**
 * Approximate distance in meters from a point to a ring's nearest segment.
 * Equirectangular approximation — plenty for a 2 km snap threshold.
 */
function distanceToRingMeters(lat: number, lng: number, ring: number[]): number {
  const mPerDegLng = METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  const px = lng * mPerDegLng;
  const py = lat * METERS_PER_DEG_LAT;
  let best = Infinity;
  const n = ring.length / 2;
  for (let i = 0; i < n - 1; i++) {
    const ax = ring[2 * i] * mPerDegLng;
    const ay = ring[2 * i + 1] * METERS_PER_DEG_LAT;
    const bx = ring[2 * i + 2] * mPerDegLng;
    const by = ring[2 * i + 3] * METERS_PER_DEG_LAT;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const d = Math.hypot(px - cx, py - cy);
    if (d < best) best = d;
  }
  return best;
}

function toProvince(shape: ProvinceShape): Province {
  return { code: shape.code, nameEn: shape.nameEn, nameKm: shape.nameKm };
}

/**
 * The Cambodian province containing (lat, lng), or null when the point is
 * outside Cambodia (sea, Thailand, Vietnam, Laos, …).
 */
export function provinceForPoint(lat: number, lng: number): Province | null {
  if (
    lat < KH_BBOX.minLat ||
    lat > KH_BBOX.maxLat ||
    lng < KH_BBOX.minLng ||
    lng > KH_BBOX.maxLng
  ) {
    return null;
  }

  for (const shape of PROVINCES) {
    for (const polygon of shape.polygons) {
      if (pointInPolygon(lat, lng, polygon)) return toProvince(shape);
    }
  }

  // Not inside any polygon — snap across simplification slivers.
  let bestShape: ProvinceShape | null = null;
  let bestDistance = BORDER_SNAP_METERS;
  for (const shape of PROVINCES) {
    for (const polygon of shape.polygons) {
      const d = distanceToRingMeters(lat, lng, polygon[0]);
      if (d < bestDistance) {
        bestDistance = d;
        bestShape = shape;
      }
    }
  }
  return bestShape ? toProvince(bestShape) : null;
}

/** Province lookup by ISO code (e.g. for stored province references). */
export function provinceByCode(code: string): Province | null {
  const shape = PROVINCES.find((p) => p.code === code);
  return shape ? toProvince(shape) : null;
}
