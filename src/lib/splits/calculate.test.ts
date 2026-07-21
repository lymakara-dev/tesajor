import { describe, expect, it } from "vitest";
import { sumCents } from "@/lib/money/cents";
import {
  assertSharesReconcile,
  computeExpenseShares,
  payersSumMatches,
} from "./calculate";

const ids = {
  a: "11111111-1111-1111-1111-111111111111",
  b: "22222222-2222-2222-2222-222222222222",
  c: "33333333-3333-3333-3333-333333333333",
};

function expectReconciles(shares: { owedAmountCents: number }[], total: number) {
  expect(sumCents(shares.map((s) => s.owedAmountCents))).toBe(total);
}

describe("payersSumMatches", () => {
  it("passes when payer amounts sum to the total", () => {
    expect(
      payersSumMatches(
        [
          { memberId: ids.a, paidAmountCents: 3000 },
          { memberId: ids.b, paidAmountCents: 2000 },
        ],
        5000,
      ),
    ).toBe(true);
  });

  it("fails when payer amounts don't sum to the total", () => {
    expect(
      payersSumMatches([{ memberId: ids.a, paidAmountCents: 3000 }], 5000),
    ).toBe(false);
  });
});

describe("equal split", () => {
  it("splits evenly with no remainder", () => {
    const result = computeExpenseShares("equal", 3000, {
      participants: [{ memberId: ids.a }, { memberId: ids.b }, { memberId: ids.c }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const s of result.shares) expect(s.owedAmountCents).toBe(1000);
    expectReconciles(result.shares, 3000);
  });

  it("gives remainder cents to the lowest member ids ($10 / 3)", () => {
    const result = computeExpenseShares("equal", 1000, {
      participants: [{ memberId: ids.c }, { memberId: ids.a }, { memberId: ids.b }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byId = Object.fromEntries(result.shares.map((s) => [s.memberId, s.owedAmountCents]));
    // 1000 / 3 = 333 remainder 1 -> lowest sorted id (a) gets the extra cent.
    expect(byId[ids.a]).toBe(334);
    expect(byId[ids.b]).toBe(333);
    expect(byId[ids.c]).toBe(333);
    expectReconciles(result.shares, 1000);
  });

  it("rejects an empty participant list", () => {
    const result = computeExpenseShares("equal", 1000, { participants: [] });
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate participants", () => {
    const result = computeExpenseShares("equal", 1000, {
      participants: [{ memberId: ids.a }, { memberId: ids.a }],
    });
    expect(result.ok).toBe(false);
  });
});

describe("exact split", () => {
  it("accepts amounts that sum to the total", () => {
    const result = computeExpenseShares("exact", 5000, {
      exact: [
        { memberId: ids.a, owedAmountCents: 3000 },
        { memberId: ids.b, owedAmountCents: 2000 },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expectReconciles(result.shares, 5000);
  });

  it("rejects amounts that don't sum to the total", () => {
    const result = computeExpenseShares("exact", 5000, {
      exact: [
        { memberId: ids.a, owedAmountCents: 3000 },
        { memberId: ids.b, owedAmountCents: 1000 },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects negative amounts", () => {
    const result = computeExpenseShares("exact", 1000, {
      exact: [{ memberId: ids.a, owedAmountCents: -100 }],
    });
    expect(result.ok).toBe(false);
  });
});

describe("percent split", () => {
  it("splits by percentage with rounding reconciled to the total", () => {
    // 33.33% / 33.33% / 33.34% of $10.00 (1000 cents)
    const result = computeExpenseShares("percent", 1000, {
      percent: [
        { memberId: ids.a, percentBasisPoints: 3333 },
        { memberId: ids.b, percentBasisPoints: 3333 },
        { memberId: ids.c, percentBasisPoints: 3334 },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expectReconciles(result.shares, 1000);
  });

  it("rejects percentages that don't sum to 100%", () => {
    const result = computeExpenseShares("percent", 1000, {
      percent: [
        { memberId: ids.a, percentBasisPoints: 5000 },
        { memberId: ids.b, percentBasisPoints: 4000 },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects non-positive percentages", () => {
    const result = computeExpenseShares("percent", 1000, {
      percent: [
        { memberId: ids.a, percentBasisPoints: 10000 },
        { memberId: ids.b, percentBasisPoints: 0 },
      ],
    });
    expect(result.ok).toBe(false);
  });
});

describe("shares split", () => {
  it("splits proportionally to share counts (2 portions vs 1)", () => {
    const result = computeExpenseShares("shares", 3000, {
      shares: [
        { memberId: ids.a, shareCount: 2 },
        { memberId: ids.b, shareCount: 1 },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byId = Object.fromEntries(result.shares.map((s) => [s.memberId, s.owedAmountCents]));
    expect(byId[ids.a]).toBe(2000);
    expect(byId[ids.b]).toBe(1000);
    expectReconciles(result.shares, 3000);
  });

  it("reconciles rounding when shares don't divide evenly", () => {
    const result = computeExpenseShares("shares", 1000, {
      shares: [
        { memberId: ids.a, shareCount: 1 },
        { memberId: ids.b, shareCount: 1 },
        { memberId: ids.c, shareCount: 1 },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expectReconciles(result.shares, 1000);
  });

  it("rejects zero or fractional share counts", () => {
    const result = computeExpenseShares("shares", 1000, {
      shares: [{ memberId: ids.a, shareCount: 0 }],
    });
    expect(result.ok).toBe(false);
  });
});

describe("itemized split", () => {
  it("splits items among assignees and tax/tip proportionally to subtotal", () => {
    // A ate a $25 item alone, B ate a $15 item alone, C ate a $10 item alone.
    // Total bill (incl. tax/tip) is $50 -> $0 tax/tip in this case; use a
    // second case below to exercise tax/tip distribution.
    const result = computeExpenseShares("itemized", 5000, {
      items: [
        { name: "Steak", priceCents: 2500, assigneeMemberIds: [ids.a] },
        { name: "Salad", priceCents: 1500, assigneeMemberIds: [ids.b] },
        { name: "Soup", priceCents: 1000, assigneeMemberIds: [ids.c] },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byId = Object.fromEntries(result.shares.map((s) => [s.memberId, s.owedAmountCents]));
    expect(byId[ids.a]).toBe(2500);
    expect(byId[ids.b]).toBe(1500);
    expect(byId[ids.c]).toBe(1000);
    expectReconciles(result.shares, 5000);
  });

  it("splits a shared item evenly between its assignees", () => {
    const result = computeExpenseShares("itemized", 1000, {
      items: [
        { name: "Fries (shared)", priceCents: 1000, assigneeMemberIds: [ids.a, ids.b, ids.c] },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 1000 / 3 = 333 remainder 1 -> lowest id gets the extra cent.
    const byId = Object.fromEntries(result.shares.map((s) => [s.memberId, s.owedAmountCents]));
    expect(byId[ids.a]).toBe(334);
    expect(byId[ids.b]).toBe(333);
    expect(byId[ids.c]).toBe(333);
    expectReconciles(result.shares, 1000);
  });

  it("distributes tax/tip proportionally to each member's item subtotal", () => {
    // Items sum to $40; total bill is $50 -> $10 tax/tip split 75/25 by subtotal.
    const result = computeExpenseShares("itemized", 5000, {
      items: [
        { name: "Steak", priceCents: 3000, assigneeMemberIds: [ids.a] },
        { name: "Salad", priceCents: 1000, assigneeMemberIds: [ids.b] },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byId = Object.fromEntries(result.shares.map((s) => [s.memberId, s.owedAmountCents]));
    // A: 3000 + floor(1000*3000/4000) = 3000 + 750 = 3750
    // B: 1000 + floor(1000*1000/4000) = 1000 + 250 = 1250
    expect(byId[ids.a]).toBe(3750);
    expect(byId[ids.b]).toBe(1250);
    expectReconciles(result.shares, 5000);
  });

  it("rejects a total less than the sum of item prices", () => {
    const result = computeExpenseShares("itemized", 1000, {
      items: [{ name: "Steak", priceCents: 2000, assigneeMemberIds: [ids.a] }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an item with no assignees", () => {
    const result = computeExpenseShares("itemized", 1000, {
      items: [{ name: "Steak", priceCents: 1000, assigneeMemberIds: [] }],
    });
    expect(result.ok).toBe(false);
  });

  it("handles free items by splitting tax/tip equally among assignees", () => {
    const result = computeExpenseShares("itemized", 300, {
      items: [
        { name: "Free sample", priceCents: 0, assigneeMemberIds: [ids.a, ids.b, ids.c] },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expectReconciles(result.shares, 300);
  });
});

describe("shared invariants", () => {
  it("assertSharesReconcile matches sumCents against the total", () => {
    const result = computeExpenseShares("equal", 999, {
      participants: [{ memberId: ids.a }, { memberId: ids.b }, { memberId: ids.c }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(assertSharesReconcile(result.shares, 999)).toBe(true);
  });

  it.each([1, 2, 3, 4, 5, 7, 10, 11, 100, 101, 9999, 10000, 10001])(
    "equal split of %i cents among 3 participants always reconciles",
    (total) => {
      const result = computeExpenseShares("equal", total, {
        participants: [{ memberId: ids.a }, { memberId: ids.b }, { memberId: ids.c }],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expectReconciles(result.shares, total);
    },
  );
});
