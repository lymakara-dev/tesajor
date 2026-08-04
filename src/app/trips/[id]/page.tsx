import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { agendaItems, trips, achievements, musicAccounts, users } from "@/db/schema";
import { provinceForPoint } from "@/lib/geo/provinces";
import { dominantProvince } from "@/lib/music/suggest";
import { getTripRole } from "@/lib/actions/trip-membership";
import { updateTripExchangeRate } from "@/lib/actions/trips";
import { canEditTrip, canManageTrip } from "@/lib/trips/permissions";
import { computeDayProgress, computeTripProgress } from "@/lib/quests/progress";
import { computeXp } from "@/lib/quests/xp";
import { dayOffsetBetween } from "@/lib/trips/clone";
import { DEFAULT_USD_TO_KHR_RATE } from "@/lib/money/exchange-rate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteLink } from "@/components/invite-link";
import { AddAgendaItemForm } from "@/components/add-agenda-item-form";
import { AgendaItemRow } from "@/components/agenda-item-row";
import { PublishTripControls } from "@/components/publish-trip-controls";
import { CloneTripButton } from "@/components/clone-trip-button";
import { YouAreHere } from "@/components/you-are-here";
import { TripDayMap } from "@/components/trip-day-map";
import { TripProgressCard } from "@/components/trip-progress-card";
import { TripMusicCard } from "@/components/trip-music-card";
import { TripReminders } from "@/components/trip-reminders";
import { TripCompleteCelebration } from "@/components/trip-complete-celebration";
import { TripCountdown } from "@/components/trip-countdown";
import { ExchangeRateSettings } from "@/components/exchange-rate-settings";
import { Compass, MapPin } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default async function TripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const t = await getTranslations("trip");

  const [trip] = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  if (!trip) notFound();

  const role = await getTripRole(id, session.user.id);
  if (!role && trip.visibility === "private") redirect("/trips");

  const items = await db.select().from(agendaItems).where(eq(agendaItems.tripId, id));
  items.sort((a, b) => a.dayNumber - b.dayNumber || a.sortOrder - b.sortOrder);
  const nextUpItemId = items.find((i) => i.status === "todo")?.id ?? null;

  const dayCount = Math.max(1, dayOffsetBetween(trip.startDate, trip.endDate) + 1);
  const tripProgress = computeTripProgress(items);

  // Music suggestion card: only when the viewer has a linked music server
  // and the trip's stops resolve to a Cambodian province (pure, no fetch —
  // the card itself talks to the music server lazily).
  const [musicAccount] = await db
    .select({ id: musicAccounts.id })
    .from(musicAccounts)
    .where(eq(musicAccounts.userId, session.user.id))
    .limit(1);
  const tripProvince = musicAccount
    ? dominantProvince(
        items
          .filter((i) => i.lat != null && i.lng != null)
          .map((i) => provinceForPoint(i.lat as number, i.lng as number)),
      )
    : null;
  const locale = await getLocale();

  const [voicePrefs] = await db
    .select({ voiceLocale: users.voiceLocale })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  // In-app spoken reminders only matter for the day the trip is actually
  // on right now.
  const todayDay = dayOffsetBetween(trip.startDate, new Date()) + 1;
  const todayItems =
    todayDay >= 1 && todayDay <= dayCount
      ? items.filter((i) => i.dayNumber === todayDay)
      : [];

  const userAchievements = await db
    .select({ key: achievements.key })
    .from(achievements)
    .where(eq(achievements.userId, session.user.id));
  const tripAchievements = userAchievements.filter((a) => a.key.includes(id));
  const xp = computeXp(
    items.filter((i) => i.status === "done").length,
    tripAchievements.length,
  );

  return (
    <div className="mx-auto max-w-[480px] px-4 py-10 space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{trip.title}</h1>
          <p className="text-muted-foreground">
            {trip.startDate.toLocaleDateString()} – {trip.endDate.toLocaleDateString()}
            {role && ` · ${role}`}
          </p>
        </div>
        {!canManageTrip(role) && trip.visibility !== "private" && (
          <CloneTripButton tripId={id} />
        )}
      </div>

      <Link
        href={`/trips/${id}/explore`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <Compass className="size-4 text-mekong" strokeWidth={1.5} />
        {t("exploreNearby")}
      </Link>

      {tripProgress.total > 0 && tripProgress.percent === 100 && <TripCompleteCelebration />}

      <TripCountdown startDate={trip.startDate} endDate={trip.endDate} />

      {todayItems.length > 0 && (
        <TripReminders
          tripId={id}
          dayNumber={todayDay}
          items={todayItems.map((i) => ({
            id: i.id,
            title: i.title,
            status: i.status,
            plannedStart: i.plannedStart,
          }))}
        />
      )}

      {tripProvince && (
        <TripMusicCard
          provinceCode={tripProvince.code}
          provinceName={locale === "km" ? tripProvince.nameKm : tripProvince.nameEn}
        />
      )}

      <TripProgressCard
        completed={tripProgress.completed}
        total={tripProgress.total}
        percent={tripProgress.percent}
        xpTotal={xp.totalXp}
        earnedKeys={tripAchievements.map((a) => a.key)}
      />

      {canManageTrip(role) && (
        <>
          <PublishTripControls tripId={id} visibility={trip.visibility} />
          <InviteLink inviteCode={trip.inviteCode} joinPath="/trips/join" title={t("inviteCollaborators")} />
          <ExchangeRateSettings
            currentRate={trip.usdKhrRate ?? DEFAULT_USD_TO_KHR_RATE}
            onSave={async (usdKhrRate) => {
              "use server";
              return updateTripExchangeRate({ tripId: id, usdKhrRate });
            }}
          />
        </>
      )}

      {items.some((i) => i.status === "todo" && i.lat != null && i.lng != null) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="size-4 text-mekong" strokeWidth={1.5} />
              {t("livePosition")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <YouAreHere
              stops={items
                .filter((i) => i.lat != null && i.lng != null)
                .map((i) => ({
                  id: i.id,
                  title: i.title,
                  status: i.status,
                  lat: i.lat as number,
                  lng: i.lng as number,
                  placeId: i.placeId,
                  placeName: i.placeName,
                  address: i.address,
                }))}
            />
          </CardContent>
        </Card>
      )}

      {Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => {
        const dayItems = items.filter((i) => i.dayNumber === day);
        const dayProgress = computeDayProgress(items, day);
        return (
          <Card key={day}>
            <CardHeader>
              <p className="text-xs font-bold text-saffron">{t("dayEyebrow", { day, dayCount })}</p>
              <CardTitle className="text-base">
                {t("dayHeading", { completed: dayProgress.completed, total: dayProgress.total })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {dayItems.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("noStopsYet")}</p>
              )}
              {dayItems.length > 0 && (
                <TripDayMap
                  stops={dayItems}
                  tripId={id}
                  dayNumber={day}
                  canComplete={canEditTrip(role)}
                  voiceLocale={voicePrefs?.voiceLocale ?? "km"}
                />
              )}
              {dayItems.map((item) => (
                <AgendaItemRow
                  key={item.id}
                  item={{ ...item, tripId: id }}
                  canComplete={canEditTrip(role)}
                  isNext={item.id === nextUpItemId}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}

      {canEditTrip(role) && (
        <AddAgendaItemForm
          tripId={id}
          dayCount={dayCount}
          defaultDay={1}
          currency={trip.baseCurrency}
          usdKhrRate={trip.usdKhrRate ?? DEFAULT_USD_TO_KHR_RATE}
        />
      )}
    </div>
  );
}
