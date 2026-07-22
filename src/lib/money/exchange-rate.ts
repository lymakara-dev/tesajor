/**
 * Static USD -> KHR rate for the dual-currency display.
 *
 * `groups` has no exchange-rate column (only `expenses.exchangeRate`,
 * which is per-expense and not a general group-level rate), and this is a
 * presentation-only retrofit that must not touch the schema — so this is
 * a hardcoded placeholder, not sourced from any live rate feed. Replace
 * with a real source before relying on it for anything beyond a rough
 * secondary-currency hint.
 */
export const USD_TO_KHR_RATE = 4100;
