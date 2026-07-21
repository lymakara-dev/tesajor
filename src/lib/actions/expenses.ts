"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  activityLog,
  expenseItems,
  expensePayers,
  expenseShares,
  expenses,
  groupMembers,
  itemAssignees,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  computeExpenseShares,
  payersSumMatches,
  type ComputeExpenseSharesInput,
} from "@/lib/splits/calculate";
import {
  createExpenseSchema,
  deleteExpenseSchema,
  updateExpenseSchema,
  type CreateExpenseInput,
} from "@/lib/validation/expenses";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function requireGroupMemberIds(groupId: string): Promise<Set<string>> {
  const members = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  return new Set(members.map((m) => m.id));
}

async function requireUserIsMember(
  groupId: string,
  userId: string,
): Promise<boolean> {
  const [membership] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  return Boolean(membership);
}

function memberIdsReferencedByExpense(input: CreateExpenseInput): string[] {
  const ids = new Set<string>(input.payers.map((p) => p.memberId));
  switch (input.splitMethod) {
    case "equal":
      input.participantMemberIds.forEach((id) => ids.add(id));
      break;
    case "exact":
    case "percent":
    case "shares":
      input.shares.forEach((s) => ids.add(s.memberId));
      break;
    case "itemized":
      input.items.forEach((item) =>
        item.assigneeMemberIds.forEach((id) => ids.add(id)),
      );
      break;
  }
  return [...ids];
}

function splitSharesInput(input: CreateExpenseInput): ComputeExpenseSharesInput {
  switch (input.splitMethod) {
    case "equal":
      return {
        participants: input.participantMemberIds.map((memberId) => ({ memberId })),
      };
    case "exact":
      return { exact: input.shares };
    case "percent":
      return { percent: input.shares };
    case "shares":
      return { shares: input.shares };
    case "itemized":
      return { items: input.items };
  }
}

export async function createExpense(
  input: unknown,
): Promise<ActionResult<{ expenseId: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = createExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid expense." };
  }
  const expense = parsed.data;

  const isMember = await requireUserIsMember(expense.groupId, session.user.id);
  if (!isMember) {
    return { ok: false, error: "You are not a member of this group." };
  }

  const validMemberIds = await requireGroupMemberIds(expense.groupId);
  const referencedIds = memberIdsReferencedByExpense(expense);
  if (referencedIds.some((id) => !validMemberIds.has(id))) {
    return { ok: false, error: "One or more members don't belong to this group." };
  }

  if (!payersSumMatches(expense.payers, expense.totalAmountCents)) {
    return { ok: false, error: "Payer amounts must sum to the total." };
  }

  const splitResult = computeExpenseShares(
    expense.splitMethod,
    expense.totalAmountCents,
    splitSharesInput(expense),
  );
  if (!splitResult.ok) {
    return { ok: false, error: splitResult.error };
  }

  const expenseId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(expenses)
      .values({
        groupId: expense.groupId,
        title: expense.title,
        totalAmountCents: expense.totalAmountCents,
        currency: expense.currency,
        category: expense.category,
        note: expense.note,
        receiptUrl: expense.receiptUrl,
        expenseDate: expense.expenseDate,
        splitMethod: expense.splitMethod,
        createdBy: session.user.id,
      })
      .returning({ id: expenses.id });

    await tx.insert(expensePayers).values(
      expense.payers.map((p) => ({
        expenseId: row.id,
        memberId: p.memberId,
        paidAmountCents: p.paidAmountCents,
      })),
    );

    await tx.insert(expenseShares).values(
      splitResult.shares.map((s) => ({
        expenseId: row.id,
        memberId: s.memberId,
        owedAmountCents: s.owedAmountCents,
        shareMeta: s.shareMeta ?? null,
      })),
    );

    if (expense.splitMethod === "itemized") {
      for (const item of expense.items) {
        const [itemRow] = await tx
          .insert(expenseItems)
          .values({
            expenseId: row.id,
            name: item.name,
            priceCents: item.priceCents,
          })
          .returning({ id: expenseItems.id });

        await tx.insert(itemAssignees).values(
          item.assigneeMemberIds.map((memberId) => ({
            itemId: itemRow.id,
            memberId,
          })),
        );
      }
    }

    await tx.insert(activityLog).values({
      groupId: expense.groupId,
      actor: session.user.id,
      action: "expense.created",
      payloadJson: { expenseId: row.id, title: expense.title, totalAmountCents: expense.totalAmountCents },
    });

    return row.id;
  });

  revalidatePath(`/groups/${expense.groupId}`);
  return { ok: true, data: { expenseId } };
}

export async function updateExpense(
  input: unknown,
): Promise<ActionResult<{ expenseId: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = updateExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid expense." };
  }
  const { expenseId, expense } = parsed.data;

  const [existing] = await db
    .select({ groupId: expenses.groupId, deletedAt: expenses.deletedAt })
    .from(expenses)
    .where(eq(expenses.id, expenseId))
    .limit(1);
  if (!existing || existing.deletedAt) {
    return { ok: false, error: "Expense not found." };
  }
  if (existing.groupId !== expense.groupId) {
    return { ok: false, error: "Expense cannot change groups." };
  }

  const isMember = await requireUserIsMember(expense.groupId, session.user.id);
  if (!isMember) {
    return { ok: false, error: "You are not a member of this group." };
  }

  const validMemberIds = await requireGroupMemberIds(expense.groupId);
  const referencedIds = memberIdsReferencedByExpense(expense);
  if (referencedIds.some((id) => !validMemberIds.has(id))) {
    return { ok: false, error: "One or more members don't belong to this group." };
  }

  if (!payersSumMatches(expense.payers, expense.totalAmountCents)) {
    return { ok: false, error: "Payer amounts must sum to the total." };
  }

  const splitResult = computeExpenseShares(
    expense.splitMethod,
    expense.totalAmountCents,
    splitSharesInput(expense),
  );
  if (!splitResult.ok) {
    return { ok: false, error: splitResult.error };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(expenses)
      .set({
        title: expense.title,
        totalAmountCents: expense.totalAmountCents,
        currency: expense.currency,
        category: expense.category,
        note: expense.note,
        receiptUrl: expense.receiptUrl,
        expenseDate: expense.expenseDate,
        splitMethod: expense.splitMethod,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, expenseId));

    await tx.delete(expensePayers).where(eq(expensePayers.expenseId, expenseId));
    await tx.delete(expenseShares).where(eq(expenseShares.expenseId, expenseId));
    const existingItems = await tx
      .select({ id: expenseItems.id })
      .from(expenseItems)
      .where(eq(expenseItems.expenseId, expenseId));
    for (const item of existingItems) {
      await tx.delete(itemAssignees).where(eq(itemAssignees.itemId, item.id));
    }
    await tx.delete(expenseItems).where(eq(expenseItems.expenseId, expenseId));

    await tx.insert(expensePayers).values(
      expense.payers.map((p) => ({
        expenseId,
        memberId: p.memberId,
        paidAmountCents: p.paidAmountCents,
      })),
    );

    await tx.insert(expenseShares).values(
      splitResult.shares.map((s) => ({
        expenseId,
        memberId: s.memberId,
        owedAmountCents: s.owedAmountCents,
        shareMeta: s.shareMeta ?? null,
      })),
    );

    if (expense.splitMethod === "itemized") {
      for (const item of expense.items) {
        const [itemRow] = await tx
          .insert(expenseItems)
          .values({
            expenseId,
            name: item.name,
            priceCents: item.priceCents,
          })
          .returning({ id: expenseItems.id });

        await tx.insert(itemAssignees).values(
          item.assigneeMemberIds.map((memberId) => ({
            itemId: itemRow.id,
            memberId,
          })),
        );
      }
    }

    await tx.insert(activityLog).values({
      groupId: expense.groupId,
      actor: session.user.id,
      action: "expense.updated",
      payloadJson: { expenseId, title: expense.title, totalAmountCents: expense.totalAmountCents },
    });
  });

  revalidatePath(`/groups/${expense.groupId}`);
  return { ok: true, data: { expenseId } };
}

export async function deleteExpense(input: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = deleteExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid request." };
  }

  const [existing] = await db
    .select({ groupId: expenses.groupId, title: expenses.title, deletedAt: expenses.deletedAt })
    .from(expenses)
    .where(eq(expenses.id, parsed.data.expenseId))
    .limit(1);
  if (!existing || existing.deletedAt) {
    return { ok: false, error: "Expense not found." };
  }

  const isMember = await requireUserIsMember(existing.groupId, session.user.id);
  if (!isMember) {
    return { ok: false, error: "You are not a member of this group." };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(expenses)
      .set({ deletedAt: new Date() })
      .where(and(eq(expenses.id, parsed.data.expenseId), isNull(expenses.deletedAt)));

    await tx.insert(activityLog).values({
      groupId: existing.groupId,
      actor: session.user.id,
      action: "expense.deleted",
      payloadJson: { expenseId: parsed.data.expenseId, title: existing.title },
    });
  });

  revalidatePath(`/groups/${existing.groupId}`);
  return { ok: true, data: undefined };
}
