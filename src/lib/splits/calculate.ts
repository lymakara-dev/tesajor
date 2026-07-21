import { sumCents } from "@/lib/money/cents";
import type {
  ComputedShare,
  EqualParticipant,
  ExactShareInput,
  ItemizedItemInput,
  PayerInput,
  PercentShareInput,
  SharesShareInput,
  SplitMethod,
  SplitResult,
} from "./types";

export function payersSumMatches(
  payers: PayerInput[],
  totalAmountCents: number,
): boolean {
  return sumCents(payers.map((p) => p.paidAmountCents)) === totalAmountCents;
}

/**
 * Reconciles floor-rounded per-participant amounts back up to the exact
 * total by handing out the leftover cents one at a time, in `order`
 * (ascending member id) — the deterministic rule from the data model doc.
 */
function distributeRemainder(
  amounts: Map<string, number>,
  remainder: number,
  order: string[],
): void {
  if (remainder < 0) {
    throw new Error("distributeRemainder: remainder must be non-negative");
  }
  if (remainder === 0 || order.length === 0) return;
  for (let i = 0; i < remainder; i++) {
    const id = order[i % order.length];
    amounts.set(id, (amounts.get(id) ?? 0) + 1);
  }
}

function hasDuplicates(ids: string[]): boolean {
  return new Set(ids).size !== ids.length;
}

function computeEqualShares(
  participants: EqualParticipant[],
  totalAmountCents: number,
): SplitResult {
  const ids = participants.map((p) => p.memberId);
  if (ids.length === 0) {
    return { ok: false, error: "At least one participant is required." };
  }
  if (hasDuplicates(ids)) {
    return { ok: false, error: "Duplicate participant in equal split." };
  }

  const n = ids.length;
  const base = Math.floor(totalAmountCents / n);
  const remainder = totalAmountCents - base * n;
  const order = [...ids].sort();

  const amounts = new Map(ids.map((id) => [id, base]));
  distributeRemainder(amounts, remainder, order);

  return {
    ok: true,
    shares: ids.map((id) => ({
      memberId: id,
      owedAmountCents: amounts.get(id)!,
    })),
  };
}

function computeExactShares(
  shares: ExactShareInput[],
  totalAmountCents: number,
): SplitResult {
  if (shares.length === 0) {
    return { ok: false, error: "At least one share is required." };
  }
  const ids = shares.map((s) => s.memberId);
  if (hasDuplicates(ids)) {
    return { ok: false, error: "Duplicate participant in exact split." };
  }
  if (shares.some((s) => s.owedAmountCents < 0)) {
    return { ok: false, error: "Exact amounts must be non-negative." };
  }

  const sum = sumCents(shares.map((s) => s.owedAmountCents));
  if (sum !== totalAmountCents) {
    return {
      ok: false,
      error: `Exact amounts sum to ${sum}, expected ${totalAmountCents}.`,
    };
  }

  return {
    ok: true,
    shares: shares.map((s) => ({
      memberId: s.memberId,
      owedAmountCents: s.owedAmountCents,
    })),
  };
}

function computePercentShares(
  shares: PercentShareInput[],
  totalAmountCents: number,
): SplitResult {
  if (shares.length === 0) {
    return { ok: false, error: "At least one share is required." };
  }
  const ids = shares.map((s) => s.memberId);
  if (hasDuplicates(ids)) {
    return { ok: false, error: "Duplicate participant in percent split." };
  }
  if (shares.some((s) => s.percentBasisPoints <= 0)) {
    return { ok: false, error: "Percentages must be positive." };
  }

  const totalBp = shares.reduce((sum, s) => sum + s.percentBasisPoints, 0);
  if (totalBp !== 10000) {
    return {
      ok: false,
      error: `Percentages sum to ${(totalBp / 100).toFixed(2)}%, expected 100%.`,
    };
  }

  const amounts = new Map<string, number>();
  for (const s of shares) {
    amounts.set(
      s.memberId,
      Math.floor((totalAmountCents * s.percentBasisPoints) / 10000),
    );
  }
  const remainder = totalAmountCents - sumCents([...amounts.values()]);
  const order = [...ids].sort();
  distributeRemainder(amounts, remainder, order);

  return {
    ok: true,
    shares: shares.map((s) => ({
      memberId: s.memberId,
      owedAmountCents: amounts.get(s.memberId)!,
      shareMeta: { percentBasisPoints: s.percentBasisPoints },
    })),
  };
}

function computeSharesShares(
  shares: SharesShareInput[],
  totalAmountCents: number,
): SplitResult {
  if (shares.length === 0) {
    return { ok: false, error: "At least one share is required." };
  }
  const ids = shares.map((s) => s.memberId);
  if (hasDuplicates(ids)) {
    return { ok: false, error: "Duplicate participant in shares split." };
  }
  if (shares.some((s) => !Number.isInteger(s.shareCount) || s.shareCount <= 0)) {
    return { ok: false, error: "Share counts must be positive integers." };
  }

  const totalShares = shares.reduce((sum, s) => sum + s.shareCount, 0);
  const amounts = new Map<string, number>();
  for (const s of shares) {
    amounts.set(
      s.memberId,
      Math.floor((totalAmountCents * s.shareCount) / totalShares),
    );
  }
  const remainder = totalAmountCents - sumCents([...amounts.values()]);
  const order = [...ids].sort();
  distributeRemainder(amounts, remainder, order);

  return {
    ok: true,
    shares: shares.map((s) => ({
      memberId: s.memberId,
      owedAmountCents: amounts.get(s.memberId)!,
      shareMeta: { shareCount: s.shareCount },
    })),
  };
}

function computeItemizedShares(
  items: ItemizedItemInput[],
  totalAmountCents: number,
): SplitResult {
  if (items.length === 0) {
    return { ok: false, error: "At least one item is required." };
  }
  for (const item of items) {
    if (item.priceCents < 0) {
      return { ok: false, error: `Item "${item.name}" has a negative price.` };
    }
    if (item.assigneeMemberIds.length === 0) {
      return { ok: false, error: `Item "${item.name}" has no assignees.` };
    }
    if (hasDuplicates(item.assigneeMemberIds)) {
      return {
        ok: false,
        error: `Item "${item.name}" has a duplicate assignee.`,
      };
    }
  }

  const itemsTotal = sumCents(items.map((i) => i.priceCents));
  const taxTip = totalAmountCents - itemsTotal;
  if (taxTip < 0) {
    return {
      ok: false,
      error: "Total must be at least the sum of item prices.",
    };
  }

  const subtotals = new Map<string, number>();
  for (const item of items) {
    const assignees = [...item.assigneeMemberIds].sort();
    const base = Math.floor(item.priceCents / assignees.length);
    const itemRemainder = item.priceCents - base * assignees.length;
    const itemAmounts = new Map(assignees.map((id) => [id, base]));
    distributeRemainder(itemAmounts, itemRemainder, assignees);
    for (const [id, amount] of itemAmounts) {
      subtotals.set(id, (subtotals.get(id) ?? 0) + amount);
    }
  }

  const memberIds = [...subtotals.keys()].sort();
  if (memberIds.length === 0) {
    return { ok: false, error: "No participants assigned to any item." };
  }

  const finalAmounts = new Map<string, number>();

  if (itemsTotal === 0) {
    // All items are free (price 0 cents) — split tax/tip equally among assignees.
    const n = memberIds.length;
    const base = Math.floor(taxTip / n);
    const remainder = taxTip - base * n;
    for (const id of memberIds) finalAmounts.set(id, base);
    distributeRemainder(finalAmounts, remainder, memberIds);
  } else {
    for (const id of memberIds) {
      const subtotal = subtotals.get(id)!;
      finalAmounts.set(id, Math.floor((taxTip * subtotal) / itemsTotal));
    }
    const remainder = taxTip - sumCents([...finalAmounts.values()]);
    distributeRemainder(finalAmounts, remainder, memberIds);
    for (const id of memberIds) {
      finalAmounts.set(id, finalAmounts.get(id)! + subtotals.get(id)!);
    }
  }

  return {
    ok: true,
    shares: memberIds.map((id) => ({
      memberId: id,
      owedAmountCents: finalAmounts.get(id)!,
      shareMeta: { itemSubtotalCents: subtotals.get(id)! },
    })),
  };
}

export interface ComputeExpenseSharesInput {
  participants?: EqualParticipant[];
  exact?: ExactShareInput[];
  percent?: PercentShareInput[];
  shares?: SharesShareInput[];
  items?: ItemizedItemInput[];
}

export function computeExpenseShares(
  method: SplitMethod,
  totalAmountCents: number,
  input: ComputeExpenseSharesInput,
): SplitResult {
  if (!Number.isInteger(totalAmountCents) || totalAmountCents <= 0) {
    return { ok: false, error: "Total amount must be a positive integer number of cents." };
  }

  switch (method) {
    case "equal":
      if (!input.participants) {
        return { ok: false, error: "Participants are required for an equal split." };
      }
      return computeEqualShares(input.participants, totalAmountCents);
    case "exact":
      if (!input.exact) {
        return { ok: false, error: "Exact amounts are required for an exact split." };
      }
      return computeExactShares(input.exact, totalAmountCents);
    case "percent":
      if (!input.percent) {
        return { ok: false, error: "Percentages are required for a percent split." };
      }
      return computePercentShares(input.percent, totalAmountCents);
    case "shares":
      if (!input.shares) {
        return { ok: false, error: "Share counts are required for a shares split." };
      }
      return computeSharesShares(input.shares, totalAmountCents);
    case "itemized":
      if (!input.items) {
        return { ok: false, error: "Items are required for an itemized split." };
      }
      return computeItemizedShares(input.items, totalAmountCents);
  }
}

export function assertSharesReconcile(
  shares: ComputedShare[],
  totalAmountCents: number,
): boolean {
  return sumCents(shares.map((s) => s.owedAmountCents)) === totalAmountCents;
}
