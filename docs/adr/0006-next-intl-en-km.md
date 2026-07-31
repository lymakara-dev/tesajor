# ADR-0006: next-intl with English + Khmer, and USD↔KHR bi-currency

- **Status**: Accepted (backfilled)
- **Date**: 2026-07-31 (documents the decision when i18n shipped)

## Context

The initial market is Cambodia: users switch between Khmer and English, and
daily payments happen in both US dollars and riel — often within one bill.
Hard-coded English strings and single-currency math would exclude the
actual target users. This scope was not in the original CLAUDE.md plan.

## Decision

- **i18n**: `next-intl` (`src/i18n/`) with locale files `messages/en.json`
  and `messages/km.json`. Every user-facing string goes through
  translations; a `setLocale` server action persists the choice. The
  contribution rule (CONTRIBUTING.md) requires every new string in both
  files.
- **Currency**: groups and trips carry an optional `usd_khr_rate` (riel per
  USD) overriding `DEFAULT_USD_TO_KHR_RATE`
  (`src/lib/money/exchange-rate.ts`); conversion lives in
  `src/lib/money/convert.ts`, and expenses store their entry currency plus
  an `exchange_rate` applied at read time — stored cents are never mutated.

## Consequences

The app is genuinely usable in its target market, and the pattern
generalizes to more locales. Costs: every string change touches two files,
and the conversion path is deliberately USD/KHR-specific — adding a third
currency market means generalizing `exchange-rate.ts` (tracked in
ROADMAP.md P3) rather than sprinkling new special cases.
