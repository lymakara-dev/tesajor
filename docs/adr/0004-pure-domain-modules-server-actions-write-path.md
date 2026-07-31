# ADR-0004: Pure domain modules; server actions as the only write path

- **Status**: Accepted (backfilled)
- **Date**: 2026-07-31 (documents a decision made at project start)

## Context

The money math *is* the product; a UI bug is annoying, a split bug destroys
trust. Client-computed amounts can be tampered with, and logic embedded in
components or route handlers is hard to test exhaustively. The same holds
for trip XP (gamification is spoofable if client-trusted).

## Decision

Two-part rule:

1. All domain logic is pure, framework-free functions under
   `src/lib/{money,splits,balances,quests,trips,telegram}/`, each with a
   co-located Vitest file (155 cases today).
2. All mutations go through server actions in `src/lib/actions/`, which
   authenticate, Zod-parse (`src/lib/validation/`), authorize
   (`requireUserIsMember` / `getTripRole`), call the pure functions,
   enforce invariants, write via Drizzle, and append to `activity_log`.
   Client components never send computed amounts/XP — only raw inputs.

## Consequences

Correctness is testable without a DB or browser; the invariants
(Σpaid = Σowed = total, nets sum to 0) are asserted where they can't be
bypassed. Costs: some duplication between client preview math and server
truth, and contributors must resist the shortcut of computing in the
component — enforced in review (see CONTRIBUTING.md). This ADR is the
reason the "coverage gap" (actions themselves untested) is acceptable
short-term: the logic inside them is.
