export type SplitMethod = "equal" | "exact" | "percent" | "shares" | "itemized";

export interface PayerInput {
  memberId: string;
  paidAmountCents: number;
}

export interface EqualParticipant {
  memberId: string;
}

export interface ExactShareInput {
  memberId: string;
  owedAmountCents: number;
}

/** Percent expressed in basis points (1% = 100bp); all inputs must sum to 10000. */
export interface PercentShareInput {
  memberId: string;
  percentBasisPoints: number;
}

/** Positive integer share counts, e.g. 2 portions vs 1. */
export interface SharesShareInput {
  memberId: string;
  shareCount: number;
}

export interface ItemizedItemInput {
  name: string;
  priceCents: number;
  assigneeMemberIds: string[];
}

export interface ComputedShare {
  memberId: string;
  owedAmountCents: number;
  shareMeta?: Record<string, unknown>;
}

export type SplitResult =
  | { ok: true; shares: ComputedShare[] }
  | { ok: false; error: string };
