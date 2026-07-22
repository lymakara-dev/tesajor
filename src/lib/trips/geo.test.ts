import { describe, expect, it } from "vitest";
import { directionsUrl, findNearestUpcomingStop, haversineDistanceMeters } from "./geo";

describe("haversineDistanceMeters", () => {
  it("returns 0 for the same point", () => {
    expect(haversineDistanceMeters({ lat: 40.7128, lng: -74.006 }, { lat: 40.7128, lng: -74.006 })).toBe(0);
  });

  it("computes a known distance (NYC to Philadelphia, ~130km) within tolerance", () => {
    const nyc = { lat: 40.7128, lng: -74.006 };
    const philly = { lat: 39.9526, lng: -75.1652 };
    const distance = haversineDistanceMeters(nyc, philly);
    expect(distance).toBeGreaterThan(120_000);
    expect(distance).toBeLessThan(140_000);
  });

  it("is symmetric", () => {
    const a = { lat: 10, lng: 20 };
    const b = { lat: 15, lng: 25 };
    expect(haversineDistanceMeters(a, b)).toBeCloseTo(haversineDistanceMeters(b, a), 5);
  });
});

describe("findNearestUpcomingStop", () => {
  const position = { lat: 0, lng: 0 };

  it("returns the closest stop with status todo", () => {
    const stops = [
      { id: "far", lat: 10, lng: 10, status: "todo" as const },
      { id: "near", lat: 1, lng: 1, status: "todo" as const },
    ];
    const result = findNearestUpcomingStop(position, stops);
    expect(result?.id).toBe("near");
  });

  it("ignores done and skipped stops", () => {
    const stops = [
      { id: "done-nearby", lat: 0.1, lng: 0.1, status: "done" as const },
      { id: "skipped-nearby", lat: 0.2, lng: 0.2, status: "skipped" as const },
      { id: "todo-far", lat: 5, lng: 5, status: "todo" as const },
    ];
    const result = findNearestUpcomingStop(position, stops);
    expect(result?.id).toBe("todo-far");
  });

  it("returns null when there are no upcoming stops", () => {
    const stops = [{ id: "1", lat: 1, lng: 1, status: "done" as const }];
    expect(findNearestUpcomingStop(position, stops)).toBeNull();
  });

  it("returns null for an empty stop list", () => {
    expect(findNearestUpcomingStop(position, [])).toBeNull();
  });
});

describe("directionsUrl", () => {
  it("uses lat/lng when available", () => {
    const url = directionsUrl({ lat: 40.7128, lng: -74.006, placeId: "abc123" });
    expect(url).toContain("destination=40.7128%2C-74.006");
    expect(url).toContain("destination_place_id=abc123");
  });

  it("falls back to address when no coordinates are set", () => {
    const url = new URL(directionsUrl({ address: "123 Main St, Springfield" }));
    expect(url.searchParams.get("destination")).toBe("123 Main St, Springfield");
  });

  it("falls back to place name when no address or coordinates are set", () => {
    const url = new URL(directionsUrl({ placeName: "Eiffel Tower" }));
    expect(url.searchParams.get("destination")).toBe("Eiffel Tower");
  });

  it("always starts with the universal maps directions base URL", () => {
    const url = directionsUrl({ lat: 1, lng: 2 });
    expect(url.startsWith("https://www.google.com/maps/dir/?api=1")).toBe(true);
  });
});
