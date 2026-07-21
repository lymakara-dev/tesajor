import { sumCents } from "@/lib/money/cents";

export interface PaidEntry {
  memberId: string;
  paidAmountCents: number;
}

export interface OwedEntry {
  memberId: string;
  owedAmountCents: number;
}

/** A settlement is `fromMemberId` paying `toMemberId` to settle a debt. */
export interface SettlementEntry {
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
}

export interface NetBalance {
  memberId: string;
  netCents: number;
}

/**
 * net(member) = paid − owed + settlements sent − settlements received.
 *
 * Paying off a debt (sending a settlement) moves your net toward zero from
 * below; being paid back (receiving a settlement) moves your net toward
 * zero from above. Positive net = the group owes them; negative = they owe
 * the group. Sum of all nets is always 0.
 */
export function computeNetBalances(
  paid: PaidEntry[],
  owed: OwedEntry[],
  settlements: SettlementEntry[],
): NetBalance[] {
  const nets = new Map<string, number>();
  const add = (memberId: string, deltaCents: number) => {
    nets.set(memberId, (nets.get(memberId) ?? 0) + deltaCents);
  };

  for (const p of paid) add(p.memberId, p.paidAmountCents);
  for (const o of owed) add(o.memberId, -o.owedAmountCents);
  for (const s of settlements) {
    add(s.fromMemberId, s.amountCents);
    add(s.toMemberId, -s.amountCents);
  }

  return [...nets.entries()].map(([memberId, netCents]) => ({ memberId, netCents }));
}

export function assertNetsSumToZero(nets: NetBalance[]): boolean {
  return sumCents(nets.map((n) => n.netCents)) === 0;
}

export interface SimplifiedTransaction {
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
}

interface Bucket {
  memberId: string;
  amount: number;
}

function byAmountDescMemberIdAsc(a: Bucket, b: Bucket): number {
  if (b.amount !== a.amount) return b.amount - a.amount;
  return a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : 0;
}

/**
 * Greedy min-cash-flow debt simplification: repeatedly matches the largest
 * debtor with the largest creditor, producing at most n−1 transactions.
 * These are suggestions the user confirms — they don't record real
 * settlements on their own.
 */
export function simplifyDebts(nets: NetBalance[]): SimplifiedTransaction[] {
  let debtors: Bucket[] = nets
    .filter((n) => n.netCents < 0)
    .map((n) => ({ memberId: n.memberId, amount: -n.netCents }));
  let creditors: Bucket[] = nets
    .filter((n) => n.netCents > 0)
    .map((n) => ({ memberId: n.memberId, amount: n.netCents }));

  const transactions: SimplifiedTransaction[] = [];

  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort(byAmountDescMemberIdAsc);
    creditors.sort(byAmountDescMemberIdAsc);

    const debtor = debtors[0];
    const creditor = creditors[0];
    const amount = Math.min(debtor.amount, creditor.amount);

    transactions.push({
      fromMemberId: debtor.memberId,
      toMemberId: creditor.memberId,
      amountCents: amount,
    });

    debtor.amount -= amount;
    creditor.amount -= amount;
    debtors = debtors.filter((d) => d.amount > 0);
    creditors = creditors.filter((c) => c.amount > 0);
  }

  return transactions;
}
