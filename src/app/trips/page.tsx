import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { trips, tripMembers, groupMembers, groups } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateTripForm } from "@/components/create-trip-form";
import { MapPinned } from "lucide-react";

export default async function TripsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const t = await getTranslations("tripsList");

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
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <CreateTripForm groups={userGroups} />

      <div className="space-y-4">
        {memberships.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        )}
        {memberships.map((m) => (
          <Link key={m.tripId} href={`/trips/${m.tripId}`}>
            <Card className="transition-[background-color,box-shadow] hover:bg-accent hover:elevation-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPinned className="size-4 text-mekong" strokeWidth={1.5} />
                  {m.title}
                </CardTitle>
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
