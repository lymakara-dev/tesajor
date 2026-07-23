/**
 * Fallback USD <-> KHR rate (riel per 1 USD), used whenever a group/trip
 * hasn't set its own `usdKhrRate` (see src/db/schema.ts). Still a rough
 * placeholder, not sourced from any live rate feed — groups/trips that
 * care about accuracy should set their own rate.
 */
export const DEFAULT_USD_TO_KHR_RATE = 4100;
