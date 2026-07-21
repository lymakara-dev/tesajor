import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  expenseItems,
  expensePayers,
  expenseShares,
  expenses,
  groupMembers,
  groups,
  itemAssignees,
} from "@/db/schema";
import { ExpenseForm } from "@/components/expense-form/expense-form";
import type { ExpenseFormInitialValues } from "@/components/expense-form/types";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string; expenseId: string }>;
}) {
  const { id, expenseId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
  if (!group) notFound();

  const members = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.groupId, id));

  const currentMember = members.find((m) => m.userId === session.user.id);
  if (!currentMember) redirect("/groups");

  const [expense] = await db
    .select()
    .from(expenses)
    .where(eq(expenses.id, expenseId))
    .limit(1);
  if (!expense || expense.groupId !== id || expense.deletedAt) notFound();

  const payers = await db
    .select()
    .from(expensePayers)
    .where(eq(expensePayers.expenseId, expenseId));

  const shares = await db
    .select()
    .from(expenseShares)
    .where(eq(expenseShares.expenseId, expenseId));

  const items = await db
    .select()
    .from(expenseItems)
    .where(eq(expenseItems.expenseId, expenseId));

  const assigneesByItem = new Map<string, string[]>();
  for (const item of items) {
    const rows = await db
      .select()
      .from(itemAssignees)
      .where(eq(itemAssignees.itemId, item.id));
    assigneesByItem.set(item.id, rows.map((r) => r.memberId));
  }

  const commonInitial = {
    title: expense.title,
    totalAmountCents: expense.totalAmountCents,
    currency: expense.currency,
    category: expense.category ?? undefined,
    note: expense.note ?? undefined,
    receiptUrl: expense.receiptUrl ?? undefined,
    expenseDate: expense.expenseDate,
    payers: payers.map((p) => ({ memberId: p.memberId, paidAmountCents: p.paidAmountCents })),
  };

  let initial: ExpenseFormInitialValues;
  if (expense.splitMethod === "equal") {
    initial = {
      ...commonInitial,
      splitMethod: "equal",
      participantMemberIds: shares.map((s) => s.memberId),
    };
  } else if (expense.splitMethod === "exact") {
    initial = {
      ...commonInitial,
      splitMethod: "exact",
      shares: shares.map((s) => ({ memberId: s.memberId, owedAmountCents: s.owedAmountCents })),
    };
  } else if (expense.splitMethod === "percent") {
    initial = {
      ...commonInitial,
      splitMethod: "percent",
      shares: shares.map((s) => ({
        memberId: s.memberId,
        percentBasisPoints: Number(
          (s.shareMeta as { percentBasisPoints?: number } | null)?.percentBasisPoints ?? 0,
        ),
      })),
    };
  } else if (expense.splitMethod === "shares") {
    initial = {
      ...commonInitial,
      splitMethod: "shares",
      shares: shares.map((s) => ({
        memberId: s.memberId,
        shareCount: Number((s.shareMeta as { shareCount?: number } | null)?.shareCount ?? 1),
      })),
    };
  } else {
    initial = {
      ...commonInitial,
      splitMethod: "itemized",
      items: items.map((item) => ({
        name: item.name,
        priceCents: item.priceCents,
        assigneeMemberIds: assigneesByItem.get(item.id) ?? [],
      })),
    };
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Edit expense</h1>
      <ExpenseForm
        groupId={group.id}
        currency={group.baseCurrency}
        currentMemberId={currentMember.id}
        mode="edit"
        expenseId={expense.id}
        initial={initial}
        members={members.map((m) => ({ id: m.id, displayName: m.displayName }))}
      />
    </div>
  );
}
