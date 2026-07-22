import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { trips, tripMembers, groupMembers, groups } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateTripForm } from "@/components/create-trip-form";

export default async function TripsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const memberships = await db
    .select({
      tripId: trips.id,
      title: trips.title,
      startDate: trips.startDate,
      endDate: trips.endDate,
      role: tripMembers.role,
    })
    .from(tripMembers)
    .innerJoin(trips, eq(tripMembers.tripId, trips.id))
    .where(eq(tripMembers.userId, session.user.id));

  const userGroups = await db
    .select({ id: groups.id, name: groups.name })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(eq(groupMembers.userId, session.user.id));

  return (
    <div className="mx-auto max-w-[480px] px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Your trips</h1>
        <p className="text-muted-foreground">Plan a trip as a day-by-day agenda of stops.</p>
      </div>

      <CreateTripForm groups={userGroups} />

      <div className="space-y-3">
        {memberships.length === 0 && (
          <p className="text-sm text-muted-foreground">No trips yet.</p>
        )}
        {memberships.map((m) => (
          <Link key={m.tripId} href={`/trips/${m.tripId}`}>
            <Card className="transition-colors hover:bg-accent">
              <CardHeader>
                <CardTitle className="text-base">{m.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {m.startDate.toLocaleDateString()} – {m.endDate.toLocaleDateString()} · {m.role}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
