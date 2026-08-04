"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { DayRouteLeg } from "@/lib/actions/routing";
import {
  etaSeconds,
  isOffRoute,
  nearestPointOnPolyline,
  remainingRouteMeters,
} from "@/lib/routing/follow";
import { directionsUrl, haversineDistanceMeters, type LatLng } from "@/lib/trips/geo";
import { Button } from "@/components/ui/button";
import { LocateFixed, Navigation, TriangleAlert } from "lucide-react";

export interface FollowStop {
  id: string;
  title: string;
  status: "todo" | "done" | "skipped";
  lat: number | null;
  lng: number | null;
  placeId: string | null;
  placeName: string | null;
  address: string | null;
}

interface Props {
  stops: FollowStop[];
  legs: DayRouteLeg[] | null;
  /** Lets the day map highlight the leg being traveled (null = none). */
  onCurrentLegChange?: (index: number | null) => void;
}

/**
 * Follow-along companion for the passenger/planner view: live position →
 * next-stop card with remaining distance and ETA, and an off-route warning
 * that hands off to Google Maps. Voice turn-by-turn is deliberately out of
 * scope (see the trip-companion plan) — the Navigate button is the way to
 * actually drive a leg. All geometry comes from src/lib/routing/follow.ts.
 */
export function FollowMode({ stops, legs, onCurrentLegChange }: Props) {
  const t = useTranslations("routing");
  const [watching, setWatching] = useState(false);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [geoError, setGeoError] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const nextStop = stops.find(
    (s): s is FollowStop & { lat: number; lng: number } =>
      s.status === "todo" && s.lat != null && s.lng != null,
  );
  const legIndex = nextStop && legs ? legs.findIndex((l) => l.toId === nextStop.id) : -1;
  const leg = legIndex >= 0 ? legs![legIndex] : null;

  useEffect(() => {
    onCurrentLegChange?.(watching && legIndex >= 0 ? legIndex : null);
  }, [watching, legIndex, onCurrentLegChange]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  function toggle() {
    if (watching) {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setWatching(false);
      setPosition(null);
      return;
    }
    if (!navigator.geolocation) {
      setGeoError(true);
      return;
    }
    setGeoError(false);
    setWatching(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        setGeoError(true);
        setWatching(false);
      },
      { enableHighAccuracy: true, maximumAge: 5_000 },
    );
  }

  const fmtDistance = (meters: number) =>
    meters < 1000
      ? t("distanceM", { distance: Math.round(meters / 10) * 10 })
      : t("distanceKm", { distance: (meters / 1000).toFixed(1) });

  // Remaining distance along the road when this leg has a route; straight
  // line otherwise (no ETA then — we don't know the road).
  let remaining: number | null = null;
  let eta: number | null = null;
  let offRoute = false;
  if (position && nextStop) {
    const points = leg?.route?.points;
    if (points) {
      const projection = nearestPointOnPolyline(position, points);
      if (projection) {
        remaining = remainingRouteMeters(points, projection);
        offRoute = isOffRoute(projection);
        eta = etaSeconds(remaining, leg!.route!.distanceMeters, leg!.route!.durationSec);
      }
    }
    if (remaining === null) {
      remaining = haversineDistanceMeters(position, nextStop);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant={watching ? "default" : "outline"} size="sm" onClick={toggle}>
        <LocateFixed className="size-4" strokeWidth={1.5} />
        {watching ? t("followStop") : t("followStart")}
      </Button>

      {geoError && <p className="text-sm text-muted-foreground">{t("geoDenied")}</p>}

      {watching && !nextStop && (
        <p className="text-sm text-muted-foreground">{t("dayComplete")}</p>
      )}

      {watching && nextStop && !position && (
        <p className="text-sm text-muted-foreground">{t("locating")}</p>
      )}

      {watching && nextStop && position && remaining !== null && (
        <div className="space-y-2 rounded-md border bg-muted/40 p-3">
          <p className="text-xs font-bold text-saffron">{t("nextStop")}</p>
          <p className="text-sm font-medium">{nextStop.title}</p>
          <p className="text-sm text-muted-foreground">
            {t("remaining", { distance: fmtDistance(remaining) })}
            {eta !== null && ` · ${t("eta", { minutes: Math.max(1, Math.round(eta / 60)) })}`}
          </p>
          {offRoute && (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <TriangleAlert className="size-4 shrink-0" strokeWidth={1.5} />
              {t("offRoute")}
            </p>
          )}
          <a
            href={directionsUrl(nextStop)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm underline underline-offset-2"
          >
            <Navigation className="size-4" strokeWidth={1.5} />
            {t("navigate")}
          </a>
        </div>
      )}
    </div>
  );
}
