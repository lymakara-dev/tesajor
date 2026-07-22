import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { agendaItems, trips, achievements } from "@/db/schema";
import { getTripRole } from "@/lib/actions/trip-membership";
import { canEditTrip, canManageTrip } from "@/lib/trips/permissions";
import { computeDayProgress, computeTripProgress } from "@/lib/quests/progress";
import { computeXp } from "@/lib/quests/xp";
import { dayOffsetBetween } from "@/lib/trips/clone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteLink } from "@/components/invite-link";
import { AddAgendaItemForm } from "@/components/add-agenda-item-form";
import { AgendaItemRow } from "@/components/agenda-item-row";
import { PublishTripControls } from "@/components/publish-trip-controls";
import { CloneTripButton } from "@/components/clone-trip-button";
import { YouAreHere } from "@/components/you-are-here";
import { TripDayMap } from "@/components/trip-day-map";

export default async function TripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [trip] = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  if (!trip) notFound();

  const role = await getTripRole(id, session.user.id);
  if (!role && trip.visibility === "private") redirect("/trips");

  const items = await db.select().from(agendaItems).where(eq(agendaItems.tripId, id));
  items.sort((a, b) => a.dayNumber - b.dayNumber || a.sortOrder - b.sortOrder);

  const dayCount = Math.max(1, dayOffsetBetween(trip.startDate, trip.endDate) + 1);
  const tripProgress = computeTripProgress(items);

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${tripProgress.percent}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {tripProgress.completed}/{tripProgress.total} stops done · {xp.totalXp} XP
            {tripAchievements.length > 0 &&
              ` · 🏆 ${tripAchievements.map((a) => a.key.split(":")[0]).join(", ")}`}
          </p>
        </CardContent>
      </Card>

      {canManageTrip(role) && (
        <>
          <PublishTripControls tripId={id} visibility={trip.visibility} />
          <InviteLink inviteCode={trip.inviteCode} joinPath="/trips/join" title="Invite collaborators" />
        </>
      )}

      {items.some((i) => i.status === "todo" && i.lat != null && i.lng != null) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live position</CardTitle>
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
              <CardTitle className="text-base">
                Day {day} — {dayProgress.completed}/{dayProgress.total} done
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {dayItems.length === 0 && (
                <p className="text-sm text-muted-foreground">No stops yet.</p>
              )}
              {dayItems.length > 0 && <TripDayMap stops={dayItems} />}
              {dayItems.map((item) => (
                <AgendaItemRow
                  key={item.id}
                  item={{ ...item, tripId: id }}
                  canComplete={canEditTrip(role)}
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
        />
      )}
    </div>
  );
}
