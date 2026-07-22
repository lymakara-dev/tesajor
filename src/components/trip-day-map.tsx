"use client";

import { useEffect, useRef, useState } from "react";
import { directionsUrl } from "@/lib/trips/geo";

export interface MapStop {
  id: string;
  title: string;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
  placeName: string | null;
  address: string | null;
}

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
const SCRIPT_ID = "google-maps-js-api";

function loadGoogleMapsScript(): Promise<void> {
  if (window.google?.maps) return Promise.resolve();

  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Maps.")));
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps."));
    document.head.appendChild(script);
  });
}

/**
 * Per-day map with numbered pins and a route polyline. Degrades to a plain
 * list of stops (with "navigate" links that need no API key at all) when
 * NEXT_PUBLIC_GOOGLE_MAPS_KEY isn't set — this is the only path actually
 * exercised in development, since a real key wasn't available while
 * building this.
 */
export function TripDayMap({ stops }: { stops: MapStop[] }) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState(false);

  const pinned = stops.filter(
    (s): s is MapStop & { lat: number; lng: number } => s.lat != null && s.lng != null,
  );

  useEffect(() => {
    if (!MAPS_KEY || pinned.length === 0 || !mapDivRef.current) return;
    let cancelled = false;

    loadGoogleMapsScript()
      .then(() => {
        if (cancelled || !mapDivRef.current) return;
        const map = new google.maps.Map(mapDivRef.current, {
          center: pinned[0],
          zoom: 13,
        });
        const bounds = new google.maps.LatLngBounds();
        pinned.forEach((stop, index) => {
          new google.maps.Marker({
            position: { lat: stop.lat, lng: stop.lng },
            map,
            label: String(index + 1),
            title: stop.title,
          });
          bounds.extend({ lat: stop.lat, lng: stop.lng });
        });
        map.fitBounds(bounds);

        if (pinned.length > 1) {
          new google.maps.Polyline({
            path: pinned.map((s) => ({ lat: s.lat, lng: s.lng })),
            geodesic: true,
            strokeOpacity: 0.7,
            map,
          });
        }
      })
      .catch(() => setLoadError(true));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned.length]);

  if (!MAPS_KEY) {
    return (
      <div className="space-y-2 rounded-md border p-3">
        <p className="text-xs text-muted-foreground">
          Map view needs a Google Maps API key (set NEXT_PUBLIC_GOOGLE_MAPS_KEY) — showing stops
          as a list instead.
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {stops.map((s) => (
            <li key={s.id}>
              {s.title}
              {(s.address || s.placeName) && (
                <>
                  {" — "}
                  <a
                    href={directionsUrl(s)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {s.address ?? s.placeName}
                  </a>
                </>
              )}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (loadError) {
    return <p className="text-sm text-destructive">Failed to load Google Maps.</p>;
  }

  if (pinned.length === 0) {
    return <p className="text-sm text-muted-foreground">No stops with a location yet.</p>;
  }

  return <div ref={mapDivRef} className="h-64 w-full rounded-md border" />;
}
