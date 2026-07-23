import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { agendaItems, groupMembers, itemNotes, trips, users } from "@/db/schema";
import { getTripRole } from "@/lib/actions/trip-membership";
import { canJournal } from "@/lib/trips/permissions";
import { Money } from "@/components/money";
import { directionsUrl } from "@/lib/trips/geo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JournalForm } from "@/components/journal-form";
import { ArrowLeft, Navigation } from "lucide-react";

export default async function AgendaItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const t = await getTranslations("item");
  const tJournal = await getTranslations("journal");

  const [trip] = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  if (!trip) notFound();

  const role = await getTripRole(id, session.user.id);
  if (!role && trip.visibility === "private") redirect("/trips");

  const [item] = await db
    .select()
    .from(agendaItems)
    .where(and(eq(agendaItems.id, itemId), eq(agendaItems.tripId, id)))
    .limit(1);
  if (!item) notFound();

  const notes = await db
    .select({
      id: itemNotes.id,
      mood: itemNotes.mood,
      noteText: itemNotes.noteText,
      tags: itemNotes.tags,
      actualCostCents: itemNotes.actualCostCents,
      createdAt: itemNotes.createdAt,
      authorId: itemNotes.authorId,
      authorName: users.name,
    })
    .from(itemNotes)
    .leftJoin(users, eq(itemNotes.authorId, users.id))
    .where(eq(itemNotes.agendaItemId, itemId));

  let groupMemberIdForAuthor: Record<string, string> = {};
  if (trip.groupId) {
    const members = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, trip.groupId));
    groupMemberIdForAuthor = Object.fromEntries(
      members.filter((m) => m.userId).map((m) => [m.userId as string, m.id]),
    );
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 py-10 space-y-6">
      <div>
        <Link href={`/trips/${id}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="size-3.5" strokeWidth={1.5} />
          {t("backToTrip")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{item.title}</h1>
        <p className="flex items-center gap-1.5 text-muted-foreground capitalize">
          {t("dayCategory", { day: item.dayNumber, category: item.category })}
          {item.plannedCostCents != null && (
            <>
              {" · "}
              {t("planned")} <Money cents={item.plannedCostCents} currency={item.currency} size="sm" />
            </>
          )}
        </p>
        {(item.address || item.placeName) && (
          <a
            href={directionsUrl(item)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center gap-1 text-sm underline"
          >
            <Navigation className="size-3.5" strokeWidth={1.5} />
            {t("navigateTo", { place: item.placeName ?? t("thisStop") })}
          </a>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("journalEntries")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {notes.length === 0 && (
            <p className="text-sm text-muted-foreground" data-testid="no-journal-entries">
              {t("noJournalEntries")}
            </p>
          )}
          {notes.map((note) => (
            <div key={note.id} className="space-y-1 border-b border-sandstone pb-3 last:border-b-0 last:pb-0">
              <p className="text-sm">
                <span className="font-medium">{note.authorName ?? t("someone")}</span>{" "}
                {note.mood && <span>{"😞😕😐🙂😄"[note.mood - 1]}</span>}
              </p>
              {note.noteText && <p className="text-sm text-muted-foreground">{note.noteText}</p>}
              {note.tags && note.tags.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {note.tags.map((tag) => tJournal(`tagLabels.${tag}`)).join(", ")}
                </p>
              )}
              {note.actualCostCents != null && (
                <div className="flex items-center gap-3">
                  <p className="text-sm">
                    {t("actualPrice")}{" "}
                    <Money cents={note.actualCostCents} currency={item.currency} tone="neutral" />
                  </p>
                  {trip.groupId && (
                    <Link
                      href={{
                        pathname: `/groups/${trip.groupId}/expenses/new`,
                        query: {
                          title: item.title,
                          amount: (note.actualCostCents / 100).toFixed(2),
                          payerMemberId: groupMemberIdForAuthor[note.authorId] ?? "",
                        },
                      }}
                    >
                      <Button size="sm" variant="outline" data-testid="add-to-group-expenses">
                        {t("addToGroupExpenses")}
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {canJournal(role) && <JournalForm agendaItemId={item.id} />}
    </div>
  );
}
