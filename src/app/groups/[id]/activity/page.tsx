import { desc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { activityLog, groupMembers, groups, users } from "@/db/schema";
import { formatCents } from "@/lib/money/cents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function describeActivity(
  action: string,
  payload: unknown,
  currency: string,
): string {
  const p = (payload ?? {}) as Record<string, unknown>;
  switch (action) {
    case "group.created":
      return `Created the group "${p.name ?? ""}".`;
    case "group.member_joined":
      return "Joined the group.";
    case "expense.created":
      return `Added expense "${p.title ?? ""}" for ${formatCents(Number(p.totalAmountCents ?? 0), currency)}.`;
    case "expense.updated":
      return `Updated expense "${p.title ?? ""}" to ${formatCents(Number(p.totalAmountCents ?? 0), currency)}.`;
    case "expense.deleted":
      return `Deleted expense "${p.title ?? ""}".`;
    case "settlement.recorded":
      return `Recorded a payment of ${formatCents(Number(p.amountCents ?? 0), currency)}.`;
    default:
      return action;
  }
}

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
  if (!group) notFound();

  const members = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.groupId, id));
  const isMember = members.some((m) => m.userId === session.user.id);
  if (!isMember) redirect("/groups");

  const entries = await db
    .select({
      id: activityLog.id,
      action: activityLog.action,
      payloadJson: activityLog.payloadJson,
      createdAt: activityLog.createdAt,
      actorName: users.name,
    })
    .from(activityLog)
    .leftJoin(users, eq(activityLog.actor, users.id))
    .where(eq(activityLog.groupId, id))
    .orderBy(desc(activityLog.createdAt));

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{group.name} — Activity</h1>
        <p className="text-muted-foreground">Every expense and settlement, in order.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {entries.length === 0 && (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          )}
          {entries.map((entry) => (
            <div key={entry.id} className="text-sm">
              <p>
                <span className="font-medium">{entry.actorName ?? "Someone"}</span>{" "}
                {describeActivity(entry.action, entry.payloadJson, group.baseCurrency)}
              </p>
              <p className="text-xs text-muted-foreground">
                {entry.createdAt.toLocaleString()}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
