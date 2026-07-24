import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { expensePayers, expenses, groupMembers, groups, telegramAccounts } from "@/db/schema";
import { deleteExpense } from "@/lib/actions/expenses";
import { updateGroupExchangeRate } from "@/lib/actions/groups";
import { DEFAULT_USD_TO_KHR_RATE } from "@/lib/money/exchange-rate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/money";
import { InviteLink } from "@/components/invite-link";
import { ExchangeRateSettings } from "@/components/exchange-rate-settings";
import { MemberAvatar } from "@/components/member-avatar";
import { cn } from "@/lib/utils";
import { Scale, Activity, Download, Receipt, Plus, Send } from "lucide-react";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const t = await getTranslations("groupDetail");

  const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
  if (!group) notFound();

  const members = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.groupId, id));

  const currentMembership = members.find((m) => m.userId === session.user.id);
  if (!currentMembership) {
    redirect("/groups");
  }
  const isOwner = currentMembership.role === "owner";

  const memberName = new Map(members.map((m) => [m.id, m.displayName]));

  const memberUserIds = members.flatMap((m) => (m.userId ? [m.userId] : []));
  const telegramConnectedUserIds = new Set<string>();
  if (memberUserIds.length > 0) {
    const linkedAccounts = await db
      .select({ userId: telegramAccounts.userId, chatId: telegramAccounts.chatId })
      .from(telegramAccounts)
      .where(inArray(telegramAccounts.userId, memberUserIds));
    for (const account of linkedAccounts) {
      if (account.chatId) telegramConnectedUserIds.add(account.userId);
    }
  }

  const expenseRows = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.groupId, id), isNull(expenses.deletedAt)))
    .orderBy(desc(expenses.expenseDate));

  const payersByExpense = new Map<string, string[]>();
  if (expenseRows.length > 0) {
    const payerRows = await db
      .select()
      .from(expensePayers)
      .where(
        inArray(
          expensePayers.expenseId,
          expenseRows.map((e) => e.id),
        ),
      );
    for (const p of payerRows) {
      const names = payersByExpense.get(p.expenseId) ?? [];
      names.push(memberName.get(p.memberId) ?? "Unknown");
      payersByExpense.set(p.expenseId, names);
    }
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 py-10 space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{group.name}</h1>
          <p className="text-muted-foreground">{t("baseCurrency", { currency: group.baseCurrency })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/groups/${id}/balances`}>
            <Button variant="outline" size="sm">
              <Scale className="size-4" strokeWidth={1.5} />
              {t("balances")}
            </Button>
          </Link>
          <Link href={`/groups/${id}/activity`}>
            <Button variant="outline" size="sm">
              <Activity className="size-4" strokeWidth={1.5} />
              {t("activity")}
            </Button>
          </Link>
          <a href={`/api/groups/${id}/export`}>
            <Button variant="outline" size="sm">
              <Download className="size-4" strokeWidth={1.5} />
              {t("exportCsv")}
            </Button>
          </a>
        </div>
      </div>

      <InviteLink inviteCode={group.inviteCode} title={t("inviteFriends")} />

      {isOwner && (
        <ExchangeRateSettings
          currentRate={group.usdKhrRate ?? DEFAULT_USD_TO_KHR_RATE}
          onSave={async (usdKhrRate) => {
            "use server";
            return updateGroupExchangeRate({ groupId: id, usdKhrRate });
          }}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base" data-testid="member-count">
            {t("members", { count: members.length })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-3">
              <MemberAvatar id={member.id} name={member.displayName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{member.displayName}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      member.role === "owner"
                        ? "bg-saffron/15 text-saffron"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {member.role === "owner" ? t("roleOwner") : t("roleMember")}
                  </span>
                  {!member.userId && (
                    <span className="text-[11px] text-muted-foreground">
                      {t("placeholderMember")}
                    </span>
                  )}
                  {member.userId && telegramConnectedUserIds.has(member.userId) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-mekong/15 px-2 py-0.5 text-[11px] font-medium text-mekong">
                      <Send className="size-3" strokeWidth={1.5} />
                      {t("telegramConnected")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("expenses")}</h2>
          <Link href={`/groups/${id}/expenses/new`}>
            <Button size="sm">
              <Plus className="size-4" strokeWidth={1.5} />
              {t("addExpense")}
            </Button>
          </Link>
        </div>

        {expenseRows.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("noExpenses")}</p>
        )}

        {expenseRows.map((expense) => (
          <Card key={expense.id} data-testid={`expense-row-${expense.id}`}>
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div className="flex min-w-0 items-start gap-2.5">
                <Receipt className="mt-0.5 size-4 shrink-0 text-mekong" strokeWidth={1.5} />
                <div className="min-w-0">
                  <p className="truncate font-medium" data-testid="expense-title">
                    {expense.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {expense.expenseDate.toLocaleDateString()} · {expense.splitMethod}
                    {expense.category ? ` · ${expense.category}` : ""} ·{" "}
                    {t("paidBy", { names: (payersByExpense.get(expense.id) ?? []).join(", ") })}
                    {expense.receiptUrl && (
                      <>
                        {" "}
                        ·{" "}
                        <a
                          href={expense.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          {t("receipt")}
                        </a>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Money
                  cents={expense.totalAmountCents}
                  currency={expense.currency}
                  data-testid="expense-amount"
                />
                <Link href={`/groups/${id}/expenses/${expense.id}/edit`}>
                  <Button variant="ghost" size="sm">
                    {t("edit")}
                  </Button>
                </Link>
                <form
                  action={async () => {
                    "use server";
                    await deleteExpense({ expenseId: expense.id });
                  }}
                >
                  <Button type="submit" variant="ghost" size="sm" data-testid="delete-expense">
                    {t("delete")}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
