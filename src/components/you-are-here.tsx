"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { findNearestUpcomingStop, directionsUrl, type StopCandidate } from "@/lib/trips/geo";
import { Button } from "@/components/ui/button";

export interface NearestStopStop extends StopCandidate {
  title: string;
  placeId: string | null;
  placeName: string | null;
  address: string | null;
}

export function YouAreHere({ stops }: { stops: NearestStopStop[] }) {
  const t = useTranslations("trip");
  const [result, setResult] = useState<{ stop: NearestStopStop; distanceMeters: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  function locate() {
    if (!("geolocation" in navigator)) {
      setError(t("geolocationUnavailable"));
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const nearest = findNearestUpcomingStop(
          { lat: position.coords.latitude, lng: position.coords.longitude },
          stops,
        );
        if (!nearest) {
          setError(t("noUpcomingStop"));
          setResult(null);
          return;
        }
        const stop = stops.find((s) => s.id === nearest.id);
        if (stop) setResult({ stop, distanceMeters: nearest.distanceMeters });
      },
      () => {
        setLocating(false);
        setError(t("locationError"));
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" onClick={locate} disabled={locating}>
        {locating ? t("locating") : t("youAreHereButton")}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && (
        <p className="text-sm">
          {t("nearestUpcomingStop")}{" "}
          <a
            href={directionsUrl(result.stop)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {result.stop.title}
          </a>{" "}
          {t("metersAway", { distance: Math.round(result.distanceMeters) })}
        </p>
      )}
    </div>
  );
}
