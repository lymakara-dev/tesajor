import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { agendaItems, groupMembers, itemNotes, trips, users } from "@/db/schema";
import { getTripRole } from "@/lib/actions/trip-membership";
import { canJournal } from "@/lib/trips/permissions";
import { formatCents } from "@/lib/money/cents";
import { directionsUrl } from "@/lib/trips/geo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JournalForm } from "@/components/journal-form";

export default async function AgendaItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

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
        <Link href={`/trips/${id}`} className="text-sm text-muted-foreground hover:underline">
          ← Back to trip
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{item.title}</h1>
        <p className="text-muted-foreground capitalize">
          Day {item.dayNumber} · {item.category}
          {item.plannedCostCents != null &&
            ` · planned ${formatCents(item.plannedCostCents, item.currency)}`}
        </p>
        {(item.address || item.placeName) && (
          <a
            href={directionsUrl(item)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline"
          >
            Navigate to {item.placeName ?? "this stop"}
          </a>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Journal entries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {notes.length === 0 && (
            <p className="text-sm text-muted-foreground">No journal entries yet.</p>
          )}
          {notes.map((note) => (
            <div key={note.id} className="space-y-1 border-b pb-3 last:border-b-0 last:pb-0">
              <p className="text-sm">
                <span className="font-medium">{note.authorName ?? "Someone"}</span>{" "}
                {note.mood && <span>{"😞😕😐🙂😄"[note.mood - 1]}</span>}
              </p>
              {note.noteText && <p className="text-sm text-muted-foreground">{note.noteText}</p>}
              {note.tags && note.tags.length > 0 && (
                <p className="text-xs text-muted-foreground capitalize">{note.tags.join(", ")}</p>
              )}
              {note.actualCostCents != null && (
                <div className="flex items-center gap-3">
                  <p className="text-sm">
                    Actual price: {formatCents(note.actualCostCents, item.currency)}
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
                      <Button size="sm" variant="outline">
                        Add to group expenses
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
