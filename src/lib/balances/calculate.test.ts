import { describe, expect, it } from "vitest";
import { sumCents } from "@/lib/money/cents";
import {
  assertNetsSumToZero,
  computeNetBalances,
  simplifyDebts,
} from "./calculate";

const ids = {
  a: "11111111-1111-1111-1111-111111111111",
  b: "22222222-2222-2222-2222-222222222222",
  c: "33333333-3333-3333-3333-333333333333",
  d: "44444444-4444-4444-4444-444444444444",
};

function netOf(nets: { memberId: string; netCents: number }[], memberId: string): number {
  return nets.find((n) => n.memberId === memberId)?.netCents ?? 0;
}

describe("computeNetBalances", () => {
  it("nets a single expense: payer is owed, non-payer owes", () => {
    // $50 dinner, A paid, split equally between A and B.
    const nets = computeNetBalances(
      [{ memberId: ids.a, paidAmountCents: 5000 }],
      [
        { memberId: ids.a, owedAmountCents: 2500 },
        { memberId: ids.b, owedAmountCents: 2500 },
      ],
      [],
    );
    expect(netOf(nets, ids.a)).toBe(2500);
    expect(netOf(nets, ids.b)).toBe(-2500);
    expect(assertNetsSumToZero(nets)).toBe(true);
  });

  it("settling a debt in full brings both parties to zero", () => {
    const nets = computeNetBalances(
      [{ memberId: ids.a, paidAmountCents: 5000 }],
      [
        { memberId: ids.a, owedAmountCents: 2500 },
        { memberId: ids.b, owedAmountCents: 2500 },
      ],
      [{ fromMemberId: ids.b, toMemberId: ids.a, amountCents: 2500 }],
    );
    expect(netOf(nets, ids.a)).toBe(0);
    expect(netOf(nets, ids.b)).toBe(0);
    expect(assertNetsSumToZero(nets)).toBe(true);
  });

  it("a partial settlement moves both parties toward zero without overshooting", () => {
    const nets = computeNetBalances(
      [{ memberId: ids.a, paidAmountCents: 5000 }],
      [
        { memberId: ids.a, owedAmountCents: 2500 },
        { memberId: ids.b, owedAmountCents: 2500 },
      ],
      [{ fromMemberId: ids.b, toMemberId: ids.a, amountCents: 1000 }],
    );
    expect(netOf(nets, ids.a)).toBe(1500);
    expect(netOf(nets, ids.b)).toBe(-1500);
    expect(assertNetsSumToZero(nets)).toBe(true);
  });

  it("sums to zero across many expenses and settlements", () => {
    const nets = computeNetBalances(
      [
        { memberId: ids.a, paidAmountCents: 3000 },
        { memberId: ids.b, paidAmountCents: 2000 },
      ],
      [
        { memberId: ids.a, owedAmountCents: 1500 },
        { memberId: ids.b, owedAmountCents: 1500 },
        { memberId: ids.c, owedAmountCents: 2000 },
      ],
      [
        { fromMemberId: ids.c, toMemberId: ids.a, amountCents: 700 },
        { fromMemberId: ids.c, toMemberId: ids.b, amountCents: 300 },
      ],
    );
    expect(assertNetsSumToZero(nets)).toBe(true);
  });
});

describe("simplifyDebts", () => {
  it("produces no transactions when all balances are zero", () => {
    const transactions = simplifyDebts([
      { memberId: ids.a, netCents: 0 },
      { memberId: ids.b, netCents: 0 },
    ]);
    expect(transactions).toEqual([]);
  });

  it("produces a single transaction for a simple debtor/creditor pair", () => {
    const transactions = simplifyDebts([
      { memberId: ids.a, netCents: 1000 },
      { memberId: ids.b, netCents: -1000 },
    ]);
    expect(transactions).toEqual([
      { fromMemberId: ids.b, toMemberId: ids.a, amountCents: 1000 },
    ]);
  });

  it("collapses a debt cycle into fewer transactions than the raw pairwise debts", () => {
    // A owes B $10, B owes C $10, C owes A $10 -> everyone nets to zero,
    // so simplification should produce ZERO transactions even though 3
    // raw pairwise debts exist.
    const transactions = simplifyDebts([
      { memberId: ids.a, netCents: 0 },
      { memberId: ids.b, netCents: 0 },
      { memberId: ids.c, netCents: 0 },
    ]);
    expect(transactions).toEqual([]);
  });

  it("simplifies a 4-person group to at most n-1 transactions", () => {
    // A is owed $30, B is owed $10, C owes $15, D owes $25.
    const nets = [
      { memberId: ids.a, netCents: 3000 },
      { memberId: ids.b, netCents: 1000 },
      { memberId: ids.c, netCents: -1500 },
      { memberId: ids.d, netCents: -2500 },
    ];
    const transactions = simplifyDebts(nets);

    expect(transactions.length).toBeLessThanOrEqual(nets.length - 1);

    // Every transaction must reconcile: each member's net inflow/outflow
    // from the suggested transactions matches their original net exactly.
    const settled = new Map<string, number>();
    for (const t of transactions) {
      settled.set(t.fromMemberId, (settled.get(t.fromMemberId) ?? 0) + t.amountCents);
      settled.set(t.toMemberId, (settled.get(t.toMemberId) ?? 0) - t.amountCents);
    }
    for (const n of nets) {
      // Applying the suggested transactions should bring every net to 0:
      // paying (fromMemberId) adds, being paid (toMemberId) subtracts.
      expect(n.netCents + (settled.get(n.memberId) ?? 0)).toBe(0);
    }
  });

  it("breaks ties deterministically by ascending member id", () => {
    // Two creditors with equal amounts; lowest member id should be paid first.
    const transactions = simplifyDebts([
      { memberId: ids.c, netCents: 500 },
      { memberId: ids.b, netCents: 500 },
      { memberId: ids.a, netCents: -1000 },
    ]);
    expect(transactions[0]).toEqual({ fromMemberId: ids.a, toMemberId: ids.b, amountCents: 500 });
    expect(transactions[1]).toEqual({ fromMemberId: ids.a, toMemberId: ids.c, amountCents: 500 });
  });

  it("handles a single debtor owing multiple creditors", () => {
    const transactions = simplifyDebts([
      { memberId: ids.a, netCents: 700 },
      { memberId: ids.b, netCents: 300 },
      { memberId: ids.c, netCents: -1000 },
    ]);
    expect(sumCents(transactions.filter((t) => t.fromMemberId === ids.c).map((t) => t.amountCents))).toBe(1000);
  });
});
