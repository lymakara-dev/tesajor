"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { addAgendaItem } from "@/lib/actions/agenda-items";
import { getNearbyPlaces, type NearbyPlaceWithDistance } from "@/lib/actions/places";
import { PLACE_CATEGORIES, type PlaceCategory } from "@/lib/places/overpass";
import { directionsUrl, type LatLng } from "@/lib/trips/geo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Compass, Navigation, Plus } from "lucide-react";

/** Explore category → agenda-item category for one-tap adds. */
const AGENDA_CATEGORY: Record<PlaceCategory, "food" | "other"> = {
  toilets: "other",
  parking: "other",
  food: "food",
  market: "other",
  fuel: "other",
  atm: "other",
  pharmacy: "other",
};

function useDistanceFormat() {
  const t = useTranslations("explore");
  return (meters: number) =>
    meters < 1000
      ? t("distanceM", { distance: Math.round(meters / 10) * 10 })
      : t("distanceKm", { distance: (meters / 1000).toFixed(1) });
}

export function AddToAgendaButton({
  tripId,
  dayNumber,
  title,
  category,
  lat,
  lng,
  placeName,
}: {
  tripId: string;
  dayNumber: number;
  title: string;
  category: "food" | "other";
  lat: number;
  lng: number;
  placeName?: string;
}) {
  const t = useTranslations("explore");
  const [state, setState] = useState<"idle" | "adding" | "added">("idle");
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setState("adding");
    setError(null);
    const result = await addAgendaItem({
      tripId,
      dayNumber,
      title,
      category,
      currency: "USD",
      lat,
      lng,
      placeName,
    });
    if (!result.ok) {
      setState("idle");
      setError(result.error);
      return;
    }
    setState("added");
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        disabled={state !== "idle"}
      >
        {state === "added" ? (
          <>
            <Check className="size-3.5" strokeWidth={1.5} />
            {t("added")}
          </>
        ) : state === "adding" ? (
          t("adding")
        ) : (
          <>
            <Plus className="size-3.5" strokeWidth={1.5} />
            {t("addToAgenda")}
          </>
        )}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ExploreEssentials({
  tripId,
  canEdit,
  defaultDay,
  fallbackPosition,
}: {
  tripId: string;
  canEdit: boolean;
  defaultDay: number;
  /** Next planned stop's coordinates — used when geolocation is unavailable/denied. */
  fallbackPosition: LatLng | null;
}) {
  const t = useTranslations("explore");
  const formatDistance = useDistanceFormat();

  const [category, setCategory] = useState<PlaceCategory | null>(null);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [places, setPlaces] = useState<NearbyPlaceWithDistance[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Resolve the search position once: live geolocation, else the next stop. */
  function resolvePosition(): Promise<{ pos: LatLng; fallback: boolean } | null> {
    if (position) return Promise.resolve({ pos: position, fallback: usingFallback });
    return new Promise((resolve) => {
      const fallBackToNextStop = () =>
        resolve(fallbackPosition ? { pos: fallbackPosition, fallback: true } : null);
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        fallBackToNextStop();
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ pos: { lat: p.coords.latitude, lng: p.coords.longitude }, fallback: false }),
        fallBackToNextStop,
        { enableHighAccuracy: true, timeout: 10_000 },
      );
    });
  }

  async function search(next: PlaceCategory) {
    setCategory(next);
    setLoading(true);
    setError(null);
    setPlaces(null);

    const resolved = await resolvePosition();
    if (!resolved) {
      setLoading(false);
      setError(t("noLocation"));
      return;
    }
    setPosition(resolved.pos);
    setUsingFallback(resolved.fallback);

    const result = await getNearbyPlaces({
      lat: resolved.pos.lat,
      lng: resolved.pos.lng,
      category: next,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPlaces(result.data.places);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Compass className="size-4 text-mekong" strokeWidth={1.5} />
          {t("essentialsTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {PLACE_CATEGORIES.map((c) => (
            <Button
              key={c}
              type="button"
              variant={category === c ? "default" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => search(c)}
              disabled={loading && category === c}
            >
              {t(`categories.${c}`)}
            </Button>
          ))}
        </div>

        {category === null && (
          <p className="text-sm text-muted-foreground">{t("searchHint")}</p>
        )}
        {usingFallback && category !== null && (
          <p className="text-xs text-muted-foreground">{t("usingNextStopLocation")}</p>
        )}
        {loading && <p className="text-sm text-muted-foreground">{t("searching")}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {places && places.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        )}

        {places && places.length > 0 && category !== null && (
          <ul className="space-y-3">
            {places.map((place) => {
              const displayName = place.name ?? t("unnamedPlace");
              return (
                <li
                  key={place.id}
                  className="flex items-start justify-between gap-3 border-b border-sandstone pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium break-words">{displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistance(place.distanceMeters)}
                    </p>
                    <a
                      href={directionsUrl({
                        lat: place.lat,
                        lng: place.lng,
                        placeName: place.name,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 flex items-center gap-1 text-xs underline"
                    >
                      <Navigation className="size-3" strokeWidth={1.5} />
                      {t("navigate")}
                    </a>
                  </div>
                  {canEdit && (
                    <AddToAgendaButton
                      tripId={tripId}
                      dayNumber={defaultDay}
                      title={displayName}
                      category={AGENDA_CATEGORY[category]}
                      lat={place.lat}
                      lng={place.lng}
                      placeName={place.name ?? undefined}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">{t("osmAttribution")}</p>
      </CardContent>
    </Card>
  );
}
