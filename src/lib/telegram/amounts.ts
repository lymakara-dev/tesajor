import type { SimplifiedTransaction } from "@/lib/balances/calculate";

export interface IncomingPaymentRequest {
  debtorMemberId: string;
  amountCents: number;
}

/** The simplified-debt transactions where `requesterMemberId` is owed money. */
export function incomingRequestsFor(
  transactions: SimplifiedTransaction[],
  requesterMemberId: string,
): IncomingPaymentRequest[] {
  return transactions
    .filter((t) => t.toMemberId === requesterMemberId)
    .map((t) => ({ debtorMemberId: t.fromMemberId, amountCents: t.amountCents }));
}
