"use client";

import { useState } from "react";
import { findNearestUpcomingStop, directionsUrl, type StopCandidate } from "@/lib/trips/geo";
import { Button } from "@/components/ui/button";

export interface NearestStopStop extends StopCandidate {
  title: string;
  placeId: string | null;
  placeName: string | null;
  address: string | null;
}

export function YouAreHere({ stops }: { stops: NearestStopStop[] }) {
  const [result, setResult] = useState<{ stop: NearestStopStop; distanceMeters: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  function locate() {
    if (!("geolocation" in navigator)) {
      setError("Geolocation isn't available in this browser.");
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
          setError("No upcoming stops with a location to navigate to.");
          setResult(null);
          return;
        }
        const stop = stops.find((s) => s.id === nearest.id);
        if (stop) setResult({ stop, distanceMeters: nearest.distanceMeters });
      },
      () => {
        setLocating(false);
        setError("Couldn't get your location — check your browser's location permission.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" onClick={locate} disabled={locating}>
        {locating ? "Locating..." : "📍 You are here"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && (
        <p className="text-sm">
          Nearest upcoming stop:{" "}
          <a
            href={directionsUrl(result.stop)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {result.stop.title}
          </a>{" "}
          ({Math.round(result.distanceMeters)}m away)
        </p>
      )}
    </div>
  );
}
