"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { getDayRoutes, type DayRouteLeg } from "@/lib/actions/routing";
import { directionsUrl } from "@/lib/trips/geo";
import { FollowMode, type FollowStop } from "@/components/follow-mode";

// Google's map tiles are light by default and don't follow the app's
// light/dark toggle on their own — without an explicit dark style, the map
// renders as a stark white rectangle against the rest of a dark-mode page.
const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#181818" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#3d3d3d" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f2f2f" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d3d3d" }] },
];

export interface MapStop {
  id: string;
  title: string;
  status: "todo" | "done" | "skipped";
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
 * Per-day map with numbered pins and the actual road route between stops
 * (OpenRouteService via the getDayRoutes action; falls back to straight
 * polylines when no OPENROUTESERVICE_API_KEY is configured or a leg can't
 * be routed). Degrades to a plain list of stops when
 * NEXT_PUBLIC_GOOGLE_MAPS_KEY isn't set — leg distance/time chips and
 * Follow mode still work there, since they don't need Google at all.
 */
export function TripDayMap({
  stops,
  tripId,
  dayNumber,
}: {
  stops: MapStop[];
  tripId?: string;
  dayNumber?: number;
}) {
  const t = useTranslations("routing");
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const legPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const [mapGeneration, setMapGeneration] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [legs, setLegs] = useState<DayRouteLeg[] | null>(null);
  const [currentLeg, setCurrentLeg] = useState<number | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const pinned = stops.filter(
    (s): s is MapStop & { lat: number; lng: number } => s.lat != null && s.lng != null,
  );

  useEffect(() => {
    if (!tripId || !dayNumber || pinned.length < 2) return;
    let cancelled = false;
    getDayRoutes({ tripId, dayNumber })
      .then((result) => {
        if (!cancelled && result.ok) setLegs(result.data.legs);
      })
      .catch(() => {
        // Roads are decoration — the straight polyline stays.
      });
    return () => {
      cancelled = true;
    };
  }, [tripId, dayNumber, pinned.length]);

  useEffect(() => {
    if (!MAPS_KEY || pinned.length === 0 || !mapDivRef.current) return;
    let cancelled = false;

    loadGoogleMapsScript()
      .then(() => {
        if (cancelled || !mapDivRef.current) return;
        const map = new google.maps.Map(mapDivRef.current, {
          center: pinned[0],
          zoom: 13,
          backgroundColor: isDark ? "#212121" : "#f5f3ec",
          styles: isDark ? DARK_MAP_STYLES : [],
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
        mapRef.current = map;
        legPolylinesRef.current = [];
        // Signal the polyline effect that it must redraw onto this map.
        setMapGeneration((g) => g + 1);
      })
      .catch(() => setLoadError(true));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned.length, isDark]);

  // (Re)draw the route: one polyline per leg — road-snapped points when the
  // leg routed, a straight segment otherwise — with the leg currently being
  // traveled (Follow mode) highlighted.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || pinned.length < 2) return;

    legPolylinesRef.current.forEach((p) => p.setMap(null));
    legPolylinesRef.current = [];

    const paths: google.maps.LatLngLiteral[][] = legs
      ? legs.flatMap((leg) => {
          const from = pinned.find((s) => s.id === leg.fromId);
          const to = pinned.find((s) => s.id === leg.toId);
          if (!from || !to) return [];
          return [leg.route?.points ?? [from, to]];
        })
      : [pinned.map((s) => ({ lat: s.lat, lng: s.lng }))];

    legPolylinesRef.current = paths.map(
      (path, index) =>
        new google.maps.Polyline({
          path,
          geodesic: true,
          strokeOpacity: legs && index === currentLeg ? 1 : 0.7,
          strokeWeight: legs && index === currentLeg ? 5 : 3,
          map,
        }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legs, currentLeg, mapGeneration]);

  const fmtDistance = (meters: number) =>
    meters < 1000
      ? t("distanceM", { distance: Math.round(meters / 10) * 10 })
      : t("distanceKm", { distance: (meters / 1000).toFixed(1) });
  const fmtDuration = (sec: number) => {
    const minutes = Math.max(1, Math.round(sec / 60));
    return minutes < 60
      ? t("durationMin", { minutes })
      : t("durationHM", { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
  };

  const routedLegs = legs?.filter((l) => l.route !== null) ?? [];
  const totals =
    routedLegs.length > 0
      ? routedLegs.reduce(
          (acc, l) => ({
            distance: acc.distance + l.route!.distanceMeters,
            duration: acc.duration + l.route!.durationSec,
          }),
          { distance: 0, duration: 0 },
        )
      : null;

  const legChips = legs && routedLegs.length > 0 && (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1.5">
        {legs.map((leg, i) =>
          leg.route ? (
            <span
              key={`${leg.fromId}-${leg.toId}`}
              className="rounded-full border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground"
            >
              {i + 1}→{i + 2} · {fmtDistance(leg.route.distanceMeters)} ·{" "}
              {fmtDuration(leg.route.durationSec)}
            </span>
          ) : null,
        )}
      </div>
      {totals && (
        <p className="text-xs text-muted-foreground">
          {t("dayTotal", {
            distance: fmtDistance(totals.distance),
            duration: fmtDuration(totals.duration),
          })}
        </p>
      )}
    </div>
  );

  const follow = pinned.length > 0 && (
    <FollowMode stops={stops as FollowStop[]} legs={legs} onCurrentLegChange={setCurrentLeg} />
  );

  if (!MAPS_KEY) {
    return (
      <div className="space-y-3">
        <div className="space-y-2 rounded-md border bg-muted/40 p-3">
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
        {legChips}
        {follow}
      </div>
    );
  }

  if (loadError) {
    return <p className="text-sm text-destructive">Failed to load Google Maps.</p>;
  }

  if (pinned.length === 0) {
    return <p className="text-sm text-muted-foreground">No stops with a location yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div ref={mapDivRef} className="h-64 w-full rounded-md border bg-muted/40" />
      {legChips}
      {follow}
    </div>
  );
}
