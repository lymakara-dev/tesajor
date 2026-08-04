import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { agendaItems, trips } from "@/db/schema";
import { getTripRole } from "@/lib/actions/trip-membership";
import { canEditTrip } from "@/lib/trips/permissions";
import { dayOffsetBetween } from "@/lib/trips/clone";
import { provinceForPoint, type Province } from "@/lib/geo/provinces";
import { rankTrendingPlaces, type TrendingPlace } from "@/lib/places/trending";
import { getTrendingSourceRows } from "@/lib/queries/trending-places";
import { directionsUrl } from "@/lib/trips/geo";
import { AddToAgendaButton, ExploreEssentials } from "@/components/explore-tab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Navigation, TrendingUp } from "lucide-react";

export default async function TripExplorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const t = await getTranslations("explore");
  const locale = await getLocale();

  const [trip] = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  if (!trip) notFound();

  const role = await getTripRole(id, session.user.id);
  if (!role && trip.visibility === "private") redirect("/trips");
  const canEdit = canEditTrip(role);

  const items = await db.select().from(agendaItems).where(eq(agendaItems.tripId, id));
  items.sort((a, b) => a.dayNumber - b.dayNumber || a.sortOrder - b.sortOrder);

  // Geolocation fallback: search around the next planned stop with coordinates.
  const nextStop = items.find((i) => i.status === "todo" && i.lat != null && i.lng != null);
  const fallbackPosition = nextStop
    ? { lat: nextStop.lat as number, lng: nextStop.lng as number }
    : null;

  // "Add to agenda" targets today's day of the trip (clamped to its range).
  const dayCount = Math.max(1, dayOffsetBetween(trip.startDate, trip.endDate) + 1);
  const defaultDay = Math.min(
    Math.max(1, dayOffsetBetween(trip.startDate, new Date()) + 1),
    dayCount,
  );

  // Trending, filtered to the trip's province(s) when the trip has located
  // stops. Hidden entirely below the 3-distinct-trip threshold (cold start).
  const tripProvinces = new Map<string, Province>();
  for (const item of items) {
    if (item.lat == null || item.lng == null) continue;
    const province = provinceForPoint(item.lat, item.lng);
    if (province) tripProvinces.set(province.code, province);
  }

  const trendingRows = await getTrendingSourceRows();
  const ranked = rankTrendingPlaces(trendingRows, { limit: 20 });
  const trendingSections: { province: Province | null; places: TrendingPlace[] }[] = [];
  if (tripProvinces.size > 0) {
    for (const province of tripProvinces.values()) {
      const places = ranked.filter(
        (place) => provinceForPoint(place.lat, place.lng)?.code === province.code,
      );
      if (places.length > 0) trendingSections.push({ province, places: places.slice(0, 8) });
    }
  } else if (ranked.length > 0) {
    trendingSections.push({ province: null, places: ranked.slice(0, 8) });
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 py-10 space-y-6">
      <div>
        <Link
          href={`/trips/${id}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" strokeWidth={1.5} />
          {t("backToTrip")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{trip.title}</p>
      </div>

      <ExploreEssentials
        tripId={id}
        canEdit={canEdit}
        defaultDay={defaultDay}
        fallbackPosition={fallbackPosition}
      />

      {trendingSections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-mekong" strokeWidth={1.5} />
              {t("trendingTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {trendingSections.map(({ province, places }) => (
              <div key={province?.code ?? "all"} className="space-y-3">
                {province && (
                  <p className="text-xs font-bold text-saffron">
                    {t("trendingIn", {
                      province: locale === "km" ? province.nameKm : province.nameEn,
                    })}
                  </p>
                )}
                <ul className="space-y-3">
                  {places.map((place) => (
                    <li
                      key={place.key}
                      className="flex items-start justify-between gap-3 border-b border-sandstone pb-3 last:border-b-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium break-words">{place.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("usedByTrips", { count: place.tripCount })}
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
                          tripId={id}
                          dayNumber={defaultDay}
                          title={place.name}
                          category="other"
                          lat={place.lat}
                          lng={place.lng}
                          placeName={place.name}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
