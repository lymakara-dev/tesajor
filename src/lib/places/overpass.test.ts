import { describe, expect, it } from "vitest";
import {
  buildOverpassQuery,
  normalizeOverpassResponse,
  PLACE_CATEGORIES,
} from "./overpass";

describe("buildOverpassQuery", () => {
  it("builds a single-selector query around the point", () => {
    const q = buildOverpassQuery(11.5564, 104.9282, "toilets");
    expect(q).toContain("[out:json]");
    expect(q).toContain('nwr["amenity"="toilets"](around:2000,11.5564,104.9282);');
    expect(q).toContain("out center");
  });

  it("combines multiple selectors for the food category", () => {
    const q = buildOverpassQuery(10.5, 104.1, "food", 1500);
    expect(q).toContain('nwr["amenity"~"^(restaurant|food_court)$"](around:1500,10.5,104.1);');
    expect(q).toContain('nwr["shop"="convenience"](around:1500,10.5,104.1);');
  });

  it("has a selector for every category", () => {
    for (const category of PLACE_CATEGORIES) {
      expect(buildOverpassQuery(11, 104, category)).toContain("nwr[");
    }
  });
});

describe("normalizeOverpassResponse", () => {
  const response = {
    elements: [
      {
        type: "node",
        id: 111,
        lat: 11.56,
        lon: 104.92,
        tags: { name: "Central Market", "name:km": "ផ្សារធំថ្មី", amenity: "marketplace" },
      },
      {
        type: "way",
        id: 222,
        center: { lat: 11.57, lon: 104.93 },
        tags: { name: "Night Market", opening_hours: "17:00-23:00", irrelevant: "dropped" },
      },
      // Unnamed but valid (common for toilets/parking) — kept, name null.
      { type: "node", id: 333, lat: 11.58, lon: 104.94, tags: { amenity: "toilets" } },
      // No coordinates — dropped.
      { type: "relation", id: 444, tags: { name: "No coords" } },
    ],
  };

  it("normalizes elements and prefers name:km over name", () => {
    const places = normalizeOverpassResponse(response, "market");
    expect(places).toHaveLength(3);
    expect(places[0]).toEqual({
      id: "node/111",
      name: "ផ្សារធំថ្មី",
      lat: 11.56,
      lng: 104.92,
      category: "market",
      tags: { name: "Central Market", "name:km": "ផ្សារធំថ្មី", amenity: "marketplace" },
    });
  });

  it("uses way/relation center coordinates and keeps only the tag subset", () => {
    const way = normalizeOverpassResponse(response, "market")[1];
    expect(way.id).toBe("way/222");
    expect(way.lat).toBe(11.57);
    expect(way.lng).toBe(104.93);
    expect(way.name).toBe("Night Market");
    expect(way.tags).toEqual({ name: "Night Market", opening_hours: "17:00-23:00" });
  });

  it("keeps unnamed elements with a null name", () => {
    const unnamed = normalizeOverpassResponse(response, "toilets")[2];
    expect(unnamed.name).toBeNull();
    expect(unnamed.tags.amenity).toBe("toilets");
  });

  it("returns [] for malformed responses", () => {
    expect(normalizeOverpassResponse(null, "atm")).toEqual([]);
    expect(normalizeOverpassResponse({}, "atm")).toEqual([]);
    expect(normalizeOverpassResponse({ elements: "nope" }, "atm")).toEqual([]);
  });
});
