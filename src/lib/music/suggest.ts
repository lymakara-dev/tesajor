/**
 * Pick a playlist for a Cambodian province. Pure, framework-free.
 *
 * Rules, in order:
 * 1. the user's explicit `province_playlists` mapping;
 * 2. a name match against the user's playlists — the province name in km or
 *    en appearing anywhere in the playlist name (e.g. "កំពត vibes" matches
 *    Kampot);
 * 3. nothing → null; the UI offers the mapping screen instead.
 */
import type { Province } from "@/lib/geo/provinces";

export interface PlaylistRef {
  id: string;
  name: string;
}

export interface ProvinceMapping {
  provinceCode: string;
  playlistId: string;
  playlistName: string;
}

export interface PlaylistSuggestion {
  playlistId: string;
  playlistName: string;
  reason: "mapping" | "name-match";
}

export function suggestPlaylist(
  province: Province,
  mappings: ProvinceMapping[],
  playlists: PlaylistRef[],
): PlaylistSuggestion | null {
  const mapped = mappings.find((m) => m.provinceCode === province.code);
  if (mapped) {
    return {
      playlistId: mapped.playlistId,
      playlistName: mapped.playlistName,
      reason: "mapping",
    };
  }

  const en = province.nameEn.toLowerCase();
  const match = playlists.find((p) => {
    const name = p.name.toLowerCase();
    return name.includes(en) || p.name.includes(province.nameKm);
  });
  if (match) {
    return { playlistId: match.id, playlistName: match.name, reason: "name-match" };
  }

  return null;
}

/**
 * The dominant province of a day's stops: the most frequent non-null
 * province; ties go to the one seen first (stop order = agenda order).
 */
export function dominantProvince(provinces: (Province | null)[]): Province | null {
  const counts = new Map<string, { province: Province; count: number }>();
  for (const p of provinces) {
    if (!p) continue;
    const entry = counts.get(p.code);
    if (entry) entry.count++;
    else counts.set(p.code, { province: p, count: 1 });
  }
  let best: { province: Province; count: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry;
  }
  return best?.province ?? null;
}
