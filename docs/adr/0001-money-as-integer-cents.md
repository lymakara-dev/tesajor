# ADR-0001: Store all money as integer minor units (cents)

- **Status**: Accepted (backfilled)
- **Date**: 2026-07-31 (documents a decision made at project start)

## Context

The product's core job is splitting bills exactly. IEEE-754 floats cannot
represent most decimal amounts (`0.1 + 0.2 !== 0.3`), and accumulating
rounding error across splits/settlements would break the invariant that
payer, share, and settlement sums reconcile to the cent. Alternatives:
Postgres `numeric` end-to-end (safe in DB but becomes float or string in
JS), or a decimal library (extra dependency, easy to bypass accidentally).

## Decision

Every monetary column is an `integer` `*_cents` column; all arithmetic goes
through `src/lib/money/cents.ts`. Division remainders are distributed
deterministically (extra cents to the earliest members in a stable order)
so `Σ paid === Σ owed === total` always holds — enforced in server actions
and asserted in the Vitest suites. Exchange rates (`expenses.exchange_rate`,
USD↔KHR) are stored as strings/integers and applied at read time, never
mutating stored amounts.

## Consequences

Money math is exact, testable, and portable. Costs: formatting must divide
by 100 at the display edge (`src/lib/money/currency.ts`), and zero-decimal
currencies like KHR need per-currency minor-unit awareness in the
conversion/formatting layer. Revisit only if a currency with non-centesimal
minor units is added.
