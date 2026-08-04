import { describe, expect, it } from "vitest";
import type { LatLng } from "@/lib/trips/geo";
import {
  OFF_ROUTE_METERS,
  etaSeconds,
  isOffRoute,
  nearestPointOnPolyline,
  remainingRouteMeters,
} from "./follow";

// A straight ~2.2 km west→east polyline near Phnom Penh's latitude.
// 0.01° of longitude at lat 11.55 ≈ 1,091 m.
const route: LatLng[] = [
  { lat: 11.55, lng: 104.9 },
  { lat: 11.55, lng: 104.91 },
  { lat: 11.55, lng: 104.92 },
];
const METERS_PER_DEG_LNG = 111_320 * Math.cos((11.55 * Math.PI) / 180);

describe("nearestPointOnPolyline", () => {
  it("returns ~zero distance for a position on the line", () => {
    const p = nearestPointOnPolyline({ lat: 11.55, lng: 104.905 }, route);
    expect(p).not.toBeNull();
    expect(p!.distanceMeters).toBeLessThan(1);
    expect(p!.segmentIndex).toBe(0);
    expect(p!.point.lng).toBeCloseTo(104.905, 5);
  });

  it("measures the perpendicular distance for a position beside the line", () => {
    // 0.001° of latitude ≈ 111.3 m north of the route.
    const p = nearestPointOnPolyline({ lat: 11.551, lng: 104.915 }, route);
    expect(p!.distanceMeters).toBeCloseTo(111.3, 0);
    expect(p!.segmentIndex).toBe(1);
    expect(p!.point.lat).toBeCloseTo(11.55, 6);
  });

  it("clamps to the polyline ends for positions before/after the route", () => {
    const before = nearestPointOnPolyline({ lat: 11.55, lng: 104.89 }, route);
    expect(before!.point.lng).toBeCloseTo(104.9, 6);
    expect(before!.segmentIndex).toBe(0);

    const after = nearestPointOnPolyline({ lat: 11.55, lng: 104.93 }, route);
    expect(after!.point.lng).toBeCloseTo(104.92, 6);
    expect(after!.segmentIndex).toBe(1);
  });

  it("returns null for a degenerate polyline", () => {
    expect(nearestPointOnPolyline({ lat: 11.55, lng: 104.9 }, [route[0]])).toBeNull();
    expect(nearestPointOnPolyline({ lat: 11.55, lng: 104.9 }, [])).toBeNull();
  });
});

describe("remainingRouteMeters", () => {
  it("shrinks as the traveler advances along the route", () => {
    const atStart = nearestPointOnPolyline({ lat: 11.55, lng: 104.9 }, route)!;
    const midway = nearestPointOnPolyline({ lat: 11.55, lng: 104.915 }, route)!;
    const remainingStart = remainingRouteMeters(route, atStart);
    const remainingMid = remainingRouteMeters(route, midway);

    expect(remainingStart).toBeCloseTo(0.02 * METERS_PER_DEG_LNG, -1);
    expect(remainingMid).toBeCloseTo(0.005 * METERS_PER_DEG_LNG, -1);
    expect(remainingMid).toBeLessThan(remainingStart);
  });

  it("is ~zero at the final point", () => {
    const atEnd = nearestPointOnPolyline({ lat: 11.55, lng: 104.92 }, route)!;
    expect(remainingRouteMeters(route, atEnd)).toBeLessThan(1);
  });
});

describe("isOffRoute", () => {
  it("uses the 200 m threshold", () => {
    const near = nearestPointOnPolyline({ lat: 11.5515, lng: 104.91 }, route)!; // ~167 m
    const far = nearestPointOnPolyline({ lat: 11.553, lng: 104.91 }, route)!; // ~334 m
    expect(OFF_ROUTE_METERS).toBe(200);
    expect(isOffRoute(near)).toBe(false);
    expect(isOffRoute(far)).toBe(true);
  });

  it("accepts a custom threshold", () => {
    const p = nearestPointOnPolyline({ lat: 11.5515, lng: 104.91 }, route)!;
    expect(isOffRoute(p, 100)).toBe(true);
  });
});

describe("etaSeconds", () => {
  it("scales the leg duration by the remaining fraction", () => {
    // 10 km leg in 20 min → 5 km left = 10 min.
    expect(etaSeconds(5_000, 10_000, 1_200)).toBe(600);
  });

  it("returns null without usable route stats (straight-line fallback)", () => {
    expect(etaSeconds(5_000, 0, 0)).toBeNull();
    expect(etaSeconds(5_000, 10_000, 0)).toBeNull();
  });
});
