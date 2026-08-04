import { describe, expect, it } from "vitest";
import { orsRequestBody, orsUrl, parseOrsRoute, roundForCache } from "./ors";

describe("orsUrl", () => {
  it("targets the geojson directions endpoint for the profile", () => {
    expect(orsUrl("driving-car")).toBe(
      "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
    );
  });
});

describe("orsRequestBody", () => {
  it("sends [lng, lat] pairs (GeoJSON order), from before to", () => {
    expect(
      orsRequestBody({ lat: 11.5564, lng: 104.9282 }, { lat: 10.6104, lng: 104.1817 }),
    ).toEqual({
      coordinates: [
        [104.9282, 11.5564],
        [104.1817, 10.6104],
      ],
    });
  });
});

describe("parseOrsRoute", () => {
  const fixture = {
    type: "FeatureCollection",
    features: [
      {
        geometry: {
          type: "LineString",
          coordinates: [
            [104.9282, 11.5564],
            [104.9, 11.4],
            [104.1817, 10.6104],
          ],
        },
        properties: { summary: { distance: 148_213.4, duration: 7_824.6 } },
      },
    ],
  };

  it("converts coordinates back to {lat, lng} and rounds the summary", () => {
    expect(parseOrsRoute(fixture)).toEqual({
      points: [
        { lat: 11.5564, lng: 104.9282 },
        { lat: 11.4, lng: 104.9 },
        { lat: 10.6104, lng: 104.1817 },
      ],
      distanceMeters: 148_213,
      durationSec: 7_825,
    });
  });

  it("throws when the response has no route", () => {
    expect(() => parseOrsRoute({ features: [] })).toThrow("No route in response");
    expect(() => parseOrsRoute({ error: { message: "quota" } })).toThrow("No route in response");
  });

  it("tolerates a missing summary (falls back to zeros)", () => {
    const route = parseOrsRoute({
      features: [
        {
          geometry: {
            coordinates: [
              [104.9, 11.5],
              [104.91, 11.51],
            ],
          },
        },
      ],
    });
    expect(route.distanceMeters).toBe(0);
    expect(route.durationSec).toBe(0);
    expect(route.points).toHaveLength(2);
  });
});

describe("roundForCache", () => {
  it("rounds to 4 decimals (~11 m) so nearby pins share a cache row", () => {
    expect(roundForCache({ lat: 11.55638, lng: 104.92824 })).toEqual({
      lat: 11.5564,
      lng: 104.9282,
    });
  });

  it("merges points closer than the grid and separates farther ones", () => {
    const a = roundForCache({ lat: 11.55641, lng: 104.92821 });
    const b = roundForCache({ lat: 11.55639, lng: 104.92819 });
    const far = roundForCache({ lat: 11.5571, lng: 104.9289 });
    expect(a).toEqual(b);
    expect(far).not.toEqual(a);
  });
});
