# Playbook: Add or change domain logic (money, splits, quests, permissions)

**Use when**: new or changed rules/math — splitting, balances, conversion,
XP, achievements, trip permissions, Telegram amounts.
**Copy the shape from**: `src/lib/splits/calculate.ts` +
`calculate.test.ts` (the fullest example of function + exhaustive tests).

## Steps

1. Pick the module: `money/` (cents, conversion, formatting) · `splits/`
   (expense → owed amounts) · `balances/` (nets, simplification) ·
   `quests/` (XP, progress, achievements) · `trips/` (permissions, clone,
   geo) · `telegram/` (verify, webhook parsing, amounts). New concern with
   no home → new directory under `src/lib/`, same conventions.
2. Write **pure functions**: no imports from `next/*`, `@/db`, or anything
   with side effects. Inputs and outputs are plain data. If the logic needs
   DB rows, the caller (server action / query helper) fetches and passes
   them in.
3. Money rules inside the function:
   - integers in/out (`*Cents`), arithmetic via `src/lib/money/cents.ts`
     helpers;
   - deterministic remainder distribution (extra cents to earliest members
     in a stable order);
   - outputs must reconcile exactly (Σ parts === total) — return values
     that make this assertable.
4. **Write the tests in the co-located `*.test.ts` before wiring anything
   up.** Cover: the happy path, remainders ($10 ÷ 3), boundaries (zero
   amounts, single member, ties), and — for bug fixes — the exact reported
   scenario as a named regression case.
5. Run `pnpm test` (or `pnpm test:watch` while iterating) until green, then
   full verification: `pnpm lint && pnpm exec tsc --noEmit && pnpm test`.
6. Wire it into a server action per
   [add-a-server-action.md](./add-a-server-action.md); client components
   may reuse the pure function for *preview only* — the server result is
   authoritative.
7. If the change alters an invariant or a documented algorithm, update
   `docs/ARCHITECTURE.md` and consider an ADR (`docs/adr/template.md`).

## Don't

- Don't put logic in the action/component "just for now" — that's how the
  layering rule dies.
- Don't use floats or `toFixed` anywhere near money; formatting happens
  only at the display edge (`src/lib/money/currency.ts`).
- Don't trust client-computed XP/amounts even as defaults.
