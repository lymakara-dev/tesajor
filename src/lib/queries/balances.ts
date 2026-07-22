import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  expensePayers,
  expenseShares,
  expenses,
  groupMembers,
  settlements,
} from "@/db/schema";
import { computeNetBalances, type NetBalance } from "@/lib/balances/calculate";

/** Net balance for every member of a group, including members with no activity (net 0). */
export async function getGroupNets(groupId: string): Promise<NetBalance[]> {
  const members = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));

  const groupExpenses = await db
    .select({ id: expenses.id })
    .from(expenses)
    .where(and(eq(expenses.groupId, groupId), isNull(expenses.deletedAt)));
  const expenseIds = groupExpenses.map((e) => e.id);

  const payers = expenseIds.length
    ? await db
        .select({ memberId: expensePayers.memberId, paidAmountCents: expensePayers.paidAmountCents })
        .from(expensePayers)
        .where(inArray(expensePayers.expenseId, expenseIds))
    : [];

  const shares = expenseIds.length
    ? await db
        .select({ memberId: expenseShares.memberId, owedAmountCents: expenseShares.owedAmountCents })
        .from(expenseShares)
        .where(inArray(expenseShares.expenseId, expenseIds))
    : [];

  const groupSettlements = await db
    .select({
      fromMemberId: settlements.fromMember,
      toMemberId: settlements.toMember,
      amountCents: settlements.amountCents,
    })
    .from(settlements)
    .where(eq(settlements.groupId, groupId));

  const allNets = computeNetBalances(payers, shares, groupSettlements);
  const netByMember = new Map(allNets.map((n) => [n.memberId, n.netCents]));

  return members.map((m) => ({
    memberId: m.id,
    netCents: netByMember.get(m.id) ?? 0,
  }));
}
