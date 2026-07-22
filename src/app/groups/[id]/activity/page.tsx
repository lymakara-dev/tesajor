import { desc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { activityLog, groupMembers, groups, users } from "@/db/schema";
import { formatCents } from "@/lib/money/cents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Pencil, Trash2, HandCoins, UserPlus, Circle } from "lucide-react";
import type { ComponentType } from "react";

type Translator = Awaited<ReturnType<typeof getTranslations<"activity">>>;

function describeActivity(
  t: Translator,
  action: string,
  payload: unknown,
  currency: string,
): string {
  const p = (payload ?? {}) as Record<string, unknown>;
  switch (action) {
    case "group.created":
      return t("groupCreated", { name: String(p.name ?? "") });
    case "group.member_joined":
      return t("memberJoined");
    case "expense.created":
      return t("expenseCreated", {
        title: String(p.title ?? ""),
        amount: formatCents(Number(p.totalAmountCents ?? 0), currency),
      });
    case "expense.updated":
      return t("expenseUpdated", {
        title: String(p.title ?? ""),
        amount: formatCents(Number(p.totalAmountCents ?? 0), currency),
      });
    case "expense.deleted":
      return t("expenseDeleted", { title: String(p.title ?? "") });
    case "settlement.recorded":
      return t("settlementRecorded", {
        amount: formatCents(Number(p.amountCents ?? 0), currency),
      });
    default:
      return action;
  }
}

const ACTION_ICONS: Record<string, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  "group.created": PlusCircle,
  "group.member_joined": UserPlus,
  "expense.created": PlusCircle,
  "expense.updated": Pencil,
  "expense.deleted": Trash2,
  "settlement.recorded": HandCoins,
};

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const t = await getTranslations("activity");

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
    <div className="mx-auto max-w-[480px] px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("heading", { groupName: group.name })}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("history")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {entries.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("noActivity")}</p>
          )}
          {entries.map((entry) => {
            const Icon = ACTION_ICONS[entry.action] ?? Circle;
            return (
              <div key={entry.id} className="flex items-start gap-2.5 text-sm">
                <Icon className="mt-0.5 size-4 shrink-0 text-mekong" strokeWidth={1.5} />
                <div>
                  <p>
                    <span className="font-medium">{entry.actorName ?? t("someone")}</span>{" "}
                    {describeActivity(t, entry.action, entry.payloadJson, group.baseCurrency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.createdAt.toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
