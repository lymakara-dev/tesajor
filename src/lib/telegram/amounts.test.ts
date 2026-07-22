import { describe, expect, it } from "vitest";
import { incomingRequestsFor } from "./amounts";

const ids = {
  a: "11111111-1111-1111-1111-111111111111",
  b: "22222222-2222-2222-2222-222222222222",
  c: "33333333-3333-3333-3333-333333333333",
};

describe("incomingRequestsFor", () => {
  it("returns only transactions where the requester is the recipient", () => {
    const transactions = [
      { fromMemberId: ids.b, toMemberId: ids.a, amountCents: 1000 },
      { fromMemberId: ids.c, toMemberId: ids.a, amountCents: 500 },
      { fromMemberId: ids.a, toMemberId: ids.c, amountCents: 300 },
    ];

    const result = incomingRequestsFor(transactions, ids.a);
    expect(result).toEqual([
      { debtorMemberId: ids.b, amountCents: 1000 },
      { debtorMemberId: ids.c, amountCents: 500 },
    ]);
  });

  it("returns an empty array when nobody owes the requester", () => {
    const transactions = [{ fromMemberId: ids.a, toMemberId: ids.b, amountCents: 1000 }];
    expect(incomingRequestsFor(transactions, ids.a)).toEqual([]);
  });

  it("returns an empty array for an empty transaction list", () => {
    expect(incomingRequestsFor([], ids.a)).toEqual([]);
  });
});
