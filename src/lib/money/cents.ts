import { USD_TO_KHR_RATE } from "./exchange-rate";

export function sumCents(amounts: number[]): number {
  return amounts.reduce((sum, a) => sum + a, 0);
}

/** Parses a dollar-amount input string into integer cents, or null if invalid. */
export function dollarsToCents(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function centsToDollarsInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function formatCents(
  cents: number,
  currency: string,
  locale = "en-US",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export interface FormattedMoney {
  /** Large/primary line — the amount in its own stored currency. */
  primary: string;
  /** Small/muted secondary line — a rough KHR conversion, or null when
   *  the amount is already in KHR or no conversion is available. */
  secondary: string | null;
}

/** KHR conversion always rounds to the nearest 100 riel and shows no decimals. */
function centsToKhrDisplay(amountCents: number, fromCurrency: string): string | null {
  if (fromCurrency === "KHR") return null;
  if (fromCurrency !== "USD") return null; // only USD has a configured conversion rate

  const riel = (amountCents / 100) * USD_TO_KHR_RATE;
  const roundedRiel = Math.round(riel / 100) * 100;
  return `៛${roundedRiel.toLocaleString("en-US")}`;
}

/**
 * Dual-currency presentation helper: primary amount in its stored
 * currency, plus a muted secondary KHR line beneath (per the Krama
 * design system). Presentation only — never used for money math.
 */
export function formatMoney(
  cents: number,
  currency: string,
  locale = "en-US",
): FormattedMoney {
  return {
    primary: formatCents(cents, currency, locale),
    secondary: centsToKhrDisplay(cents, currency),
  };
}
