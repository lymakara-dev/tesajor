import { describe, expect, it } from "vitest";
import type { Province } from "@/lib/geo/provinces";
import { dominantProvince, suggestPlaylist } from "./suggest";

const kampot: Province = { code: "KH-7", nameEn: "Kampot", nameKm: "កំពត" };
const siemReap: Province = { code: "KH-17", nameEn: "Siem Reap", nameKm: "សៀមរាប" };
const kep: Province = { code: "KH-23", nameEn: "Kep", nameKm: "កែប" };

describe("suggestPlaylist", () => {
  it("prefers the explicit province mapping over a name match", () => {
    const suggestion = suggestPlaylist(
      kampot,
      [{ provinceCode: "KH-7", playlistId: "pl-9", playlistName: "Chill coast" }],
      [{ id: "pl-1", name: "Kampot hits" }],
    );
    expect(suggestion).toEqual({
      playlistId: "pl-9",
      playlistName: "Chill coast",
      reason: "mapping",
    });
  });

  it("ignores mappings for other provinces", () => {
    const suggestion = suggestPlaylist(
      kampot,
      [{ provinceCode: "KH-17", playlistId: "pl-9", playlistName: "Temple run" }],
      [],
    );
    expect(suggestion).toBeNull();
  });

  it("matches the English province name case-insensitively", () => {
    const suggestion = suggestPlaylist(siemReap, [], [
      { id: "pl-1", name: "Beach day" },
      { id: "pl-2", name: "SIEM REAP nights" },
    ]);
    expect(suggestion).toEqual({
      playlistId: "pl-2",
      playlistName: "SIEM REAP nights",
      reason: "name-match",
    });
  });

  it("matches the Khmer province name", () => {
    const suggestion = suggestPlaylist(kampot, [], [{ id: "pl-1", name: "កំពត vibes" }]);
    expect(suggestion).toEqual({
      playlistId: "pl-1",
      playlistName: "កំពត vibes",
      reason: "name-match",
    });
  });

  it("returns null when nothing matches", () => {
    expect(suggestPlaylist(kep, [], [{ id: "pl-1", name: "Phnom Penh traffic jams" }])).toBeNull();
  });
});

describe("dominantProvince", () => {
  it("returns the most frequent province", () => {
    expect(dominantProvince([kampot, siemReap, kampot])).toEqual(kampot);
  });

  it("ignores nulls (stops outside Cambodia or without coordinates)", () => {
    expect(dominantProvince([null, kep, null])).toEqual(kep);
  });

  it("breaks ties by agenda order", () => {
    expect(dominantProvince([siemReap, kampot])).toEqual(siemReap);
  });

  it("returns null for no usable stops", () => {
    expect(dominantProvince([])).toBeNull();
    expect(dominantProvince([null, null])).toBeNull();
  });
});
