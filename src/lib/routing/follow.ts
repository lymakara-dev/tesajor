/**
 * Follow-mode geometry: where is the traveler relative to the day's route?
 * Pure, framework-free — components only render what this computes.
 *
 * Distances use a local equirectangular projection (meters east/north of
 * the query point). At leg scale (tens of km) the error vs. true geodesics
 * is far below the 200 m off-route threshold.
 */
import type { LatLng } from "@/lib/trips/geo";

/** Off-route when farther than this from the route polyline. */
export const OFF_ROUTE_METERS = 200;

const METERS_PER_DEG_LAT = 111_320;

/** Project to meters relative to `origin` (equirectangular). */
function toMeters(point: LatLng, origin: LatLng): { x: number; y: number } {
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180);
  return {
    x: (point.lng - origin.lng) * metersPerDegLng,
    y: (point.lat - origin.lat) * METERS_PER_DEG_LAT,
  };
}

function segmentLengthMeters(a: LatLng, b: LatLng): number {
  const m = toMeters(b, a);
  return Math.hypot(m.x, m.y);
}

export interface PolylineProjection {
  /** Closest point on the polyline. */
  point: LatLng;
  /** Index of the segment (points[i] → points[i+1]) it falls on. */
  segmentIndex: number;
  /** Distance from the position to that closest point. */
  distanceMeters: number;
}

/**
 * Closest point on a polyline to `position`. Returns null for degenerate
 * polylines (< 2 points).
 */
export function nearestPointOnPolyline(
  position: LatLng,
  points: LatLng[],
): PolylineProjection | null {
  if (points.length < 2) return null;

  let best: PolylineProjection | null = null;
  for (let i = 0; i < points.length - 1; i++) {
    const a = toMeters(points[i], position);
    const b = toMeters(points[i + 1], position);
    const abX = b.x - a.x;
    const abY = b.y - a.y;
    const lengthSq = abX * abX + abY * abY;
    // t = how far along the segment the perpendicular foot lands, clamped
    // to the segment ends (0 length → stay at the start point).
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * abX + a.y * abY) / lengthSq));
    const footX = a.x + t * abX;
    const footY = a.y + t * abY;
    const distanceMeters = Math.hypot(footX, footY);
    if (!best || distanceMeters < best.distanceMeters) {
      best = {
        point: {
          lat: points[i].lat + t * (points[i + 1].lat - points[i].lat),
          lng: points[i].lng + t * (points[i + 1].lng - points[i].lng),
        },
        segmentIndex: i,
        distanceMeters,
      };
    }
  }
  return best;
}

/** Route length from a projection to the end of the polyline. */
export function remainingRouteMeters(points: LatLng[], projection: PolylineProjection): number {
  let total = segmentLengthMeters(projection.point, points[projection.segmentIndex + 1]);
  for (let i = projection.segmentIndex + 1; i < points.length - 1; i++) {
    total += segmentLengthMeters(points[i], points[i + 1]);
  }
  return total;
}

export function isOffRoute(
  projection: PolylineProjection,
  thresholdMeters: number = OFF_ROUTE_METERS,
): boolean {
  return projection.distanceMeters > thresholdMeters;
}

/**
 * Remaining time assuming the leg's average speed. Null when the route has
 * no usable distance/duration (e.g. straight-line fallback legs).
 */
export function etaSeconds(
  remainingMeters: number,
  routeDistanceMeters: number,
  routeDurationSec: number,
): number | null {
  if (routeDistanceMeters <= 0 || routeDurationSec <= 0) return null;
  return Math.round(remainingMeters * (routeDurationSec / routeDistanceMeters));
}
