import { centsToDollarsInput, dollarsToCents } from "./cents";
import type { Currency } from "./currency";

/**
 * Converts an integer "cents" amount (dollars*100 for USD, riel*100 for
 * KHR — the *100 convention money/cents.ts uses for both currencies, so
 * split math stays integer-only regardless of currency) from one
 * supported currency to another, using `usdKhrRate` (riel per 1 USD).
 * Same currency is a no-op. Rounds to the nearest integer cent in the
 * target currency.
 */
export function convertCents(
  amountCents: number,
  from: Currency,
  to: Currency,
  usdKhrRate: number,
): number {
  if (from === to) return amountCents;
  if (from === "USD" && to === "KHR") return Math.round(amountCents * usdKhrRate);
  if (from === "KHR" && to === "USD") return Math.round(amountCents / usdKhrRate);
  // Exhaustive for the two currently-supported currencies.
  throw new Error(`Unsupported currency pair: ${from} -> ${to}`);
}

/** Riel has no practical decimal input; USD keeps the usual 2 decimals. */
export function centsToAmountInput(cents: number, currency: Currency): string {
  if (currency === "KHR") return String(Math.round(cents / 100));
  return centsToDollarsInput(cents);
}

/**
 * Converts a decimal-string amount (as typed into a plain number input) in
 * `from` currency to the equivalent string in `to` currency, formatted per
 * centsToAmountInput. Returns null for empty/invalid input, matching
 * dollarsToCents's own null-on-invalid convention.
 */
export function convertAmountString(
  value: string,
  from: Currency,
  to: Currency,
  usdKhrRate: number,
): string | null {
  const cents = dollarsToCents(value);
  if (cents === null) return null;
  return centsToAmountInput(convertCents(cents, from, to, usdKhrRate), to);
}
