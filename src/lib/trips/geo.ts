export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_METERS = 6_371_000;

export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_METERS * c;
}

export interface StopCandidate extends LatLng {
  id: string;
  status: "todo" | "done" | "skipped";
}

export interface NearestStop {
  id: string;
  distanceMeters: number;
}

/** Nearest not-yet-done stop to the given position — the "next stop" to head to. */
export function findNearestUpcomingStop(
  position: LatLng,
  stops: StopCandidate[],
): NearestStop | null {
  const upcoming = stops.filter((s) => s.status === "todo");
  if (upcoming.length === 0) return null;

  let nearest: NearestStop | null = null;
  for (const stop of upcoming) {
    const distanceMeters = haversineDistanceMeters(position, stop);
    if (!nearest || distanceMeters < nearest.distanceMeters) {
      nearest = { id: stop.id, distanceMeters };
    }
  }
  return nearest;
}

/** The universal Google Maps directions URL — works with no API key. */
export function directionsUrl(destination: {
  lat?: number | null;
  lng?: number | null;
  placeId?: string | null;
  placeName?: string | null;
  address?: string | null;
}): string {
  const params = new URLSearchParams({ api: "1" });

  if (destination.lat != null && destination.lng != null) {
    params.set("destination", `${destination.lat},${destination.lng}`);
  } else {
    params.set("destination", destination.address ?? destination.placeName ?? "");
  }
  if (destination.placeId) {
    params.set("destination_place_id", destination.placeId);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
