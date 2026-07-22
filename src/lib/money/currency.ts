/**
 * Currencies selectable in the UI. Kept deliberately small — the app's only
 * real dual-currency support is USD/KHR (see exchange-rate.ts) so letting
 * users type an arbitrary ISO code would create currencies the rest of the
 * app can't display or convert.
 */
export const SUPPORTED_CURRENCIES = ["USD", "KHR"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_LABELS: Record<Currency, string> = {
  USD: "USD — US Dollar",
  KHR: "KHR — Cambodian Riel",
};

export function isSupportedCurrency(value: string): value is Currency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}
