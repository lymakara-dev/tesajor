import { describe, expect, it } from "vitest";
import { placeKey, rankTrendingPlaces, type TrendingSourceRow } from "./trending";

const NOW = new Date("2026-07-31T00:00:00Z");

function row(overrides: Partial<TrendingSourceRow>): TrendingSourceRow {
  return {
    placeId: null,
    title: "Somewhere",
    lat: 13.4,
    lng: 103.8,
    tripId: "trip-1",
    createdAt: NOW,
    ...overrides,
  };
}

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

describe("placeKey", () => {
  it("prefers placeId", () => {
    expect(placeKey({ placeId: "gm123", title: "Phare Circus" })).toBe("gm123");
  });

  it("falls back to a normalized title", () => {
    expect(placeKey({ placeId: null, title: "  Phare Circus " })).toBe("title:phare circus");
  });
});

describe("rankTrendingPlaces", () => {
  it("hides places below the minimum distinct-trip threshold (default 3)", () => {
    const rows = [
      row({ title: "Phare Circus", tripId: "t1" }),
      row({ title: "Phare Circus", tripId: "t2" }),
    ];
    expect(rankTrendingPlaces(rows, { now: NOW })).toEqual([]);
  });

  it("shows a place once it reaches 3 distinct trips", () => {
    const rows = ["t1", "t2", "t3"].map((tripId) => row({ title: "Phare Circus", tripId }));
    const ranked = rankTrendingPlaces(rows, { now: NOW });
    expect(ranked).toHaveLength(1);
    expect(ranked[0].name).toBe("Phare Circus");
    expect(ranked[0].tripCount).toBe(3);
  });

  it("counts a trip only once even when it references the place twice", () => {
    const rows = [
      row({ title: "Psar Chas", tripId: "t1" }),
      row({ title: "Psar Chas", tripId: "t1" }),
      row({ title: "Psar Chas", tripId: "t2" }),
      row({ title: "Psar Chas", tripId: "t3" }),
    ];
    const ranked = rankTrendingPlaces(rows, { now: NOW });
    expect(ranked).toHaveLength(1);
    expect(ranked[0].tripCount).toBe(3);
  });

  it("groups by placeId across differently spelled titles", () => {
    const rows = [
      row({ placeId: "gm1", title: "Phare, The Cambodian Circus", tripId: "t1" }),
      row({ placeId: "gm1", title: "Phare Circus", tripId: "t2" }),
      row({ placeId: "gm1", title: "phare circus", tripId: "t3" }),
    ];
    expect(rankTrendingPlaces(rows, { now: NOW })).toHaveLength(1);
  });

  it("ranks recent popularity above stale popularity at equal counts", () => {
    const recent = ["t1", "t2", "t3"].map((tripId) =>
      row({ title: "New Hotness", tripId, createdAt: daysAgo(5) }),
    );
    const stale = ["t4", "t5", "t6"].map((tripId) =>
      row({ title: "Old Favourite", tripId, createdAt: daysAgo(400) }),
    );
    const ranked = rankTrendingPlaces([...stale, ...recent], { now: NOW });
    expect(ranked.map((p) => p.name)).toEqual(["New Hotness", "Old Favourite"]);
  });

  it("more trips beats fewer trips at similar recency", () => {
    const popular = ["t1", "t2", "t3", "t4"].map((tripId) =>
      row({ title: "Popular", tripId, createdAt: daysAgo(10) }),
    );
    const niche = ["t5", "t6", "t7"].map((tripId) =>
      row({ title: "Niche", tripId, createdAt: daysAgo(10) }),
    );
    const ranked = rankTrendingPlaces([...niche, ...popular], { now: NOW });
    expect(ranked.map((p) => p.name)).toEqual(["Popular", "Niche"]);
  });

  it("respects the limit and never returns future-dated boosts (age clamped at 0)", () => {
    const rows: TrendingSourceRow[] = [];
    for (let place = 0; place < 15; place++) {
      for (const trip of ["a", "b", "c"]) {
        rows.push(
          row({ title: `Place ${place}`, tripId: `${trip}${place}`, createdAt: daysAgo(-3) }),
        );
      }
    }
    const ranked = rankTrendingPlaces(rows, { now: NOW, limit: 10 });
    expect(ranked).toHaveLength(10);
    for (const p of ranked) expect(p.score).toBeLessThanOrEqual(3);
  });

  it("returns [] for no rows", () => {
    expect(rankTrendingPlaces([], { now: NOW })).toEqual([]);
  });
});
