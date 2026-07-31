# Contributing

This guide covers how we work on Tesajor as a team. For environment setup
see the [README](./README.md); for a guided first week see
[docs/ONBOARDING.md](./docs/ONBOARDING.md); for how the system fits
together see [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Workflow

- `main` is the integration branch and should always be deployable. Don't
  commit to it directly — branch and open a PR.
- Branch names: `feat/<short-topic>`, `fix/<short-topic>`,
  `chore/<short-topic>`, `docs/<short-topic>`.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`) — this is
  already the style of the existing history, keep it consistent.
- Keep PRs focused: one feature or fix per PR. Schema changes ship with
  their migration in the same PR (see
  [REFERENCE.md § Schema changes](./docs/REFERENCE.md#schema-changes)).
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, and unit tests on
  every PR. A red CI is a blocker; don't merge around it.

## Code standards

These are the rules that protect the product's correctness. They are not
stylistic preferences.

1. **Money is integer cents.** Never a float, never a JS `number` derived
   from division without going through `src/lib/money/cents.ts`. If your
   change touches amounts, the invariants in
   [ARCHITECTURE.md § Invariants](./docs/ARCHITECTURE.md#invariants-enforced-in-code-asserted-in-tests)
   must still hold and must be covered by a test.
2. **Never trust the client.** Every server action parses its input with a
   Zod schema from `src/lib/validation/` *before* doing anything, and
   re-checks membership/roles server-side
   (`requireUserIsMember`, `getTripRole`). Client-side computed amounts,
   XP, or permissions are display-only.
3. **Domain logic goes in pure modules.** New math/rules belong in
   `src/lib/{money,splits,balances,quests,trips,telegram}/` as
   framework-free functions with co-located Vitest tests — not inline in a
   server action or component.
4. **Every user-facing string is translated.** Add the key to *both*
   `messages/en.json` and `messages/km.json` and render it via `next-intl`.
   A PR with hard-coded UI strings is not mergeable.
5. **Mutations are audited.** Group-data writes append to `activity_log`;
   expenses are soft-deleted (`deleted_at`), never hard-deleted.
6. **Optional services degrade gracefully.** Telegram, Google Maps, and
   Cloudinary are all optional; a missing env var must produce a friendly
   fallback, never a crash. Follow the existing patterns.
7. TypeScript strict mode; no `any` without a comment explaining why.
   Dependencies must be MIT/Apache-2.0 licensed (commercial product — no
   GPL/AGPL).
8. Mobile-first: the primary use case is a phone at a restaurant table.
   Check new UI at small widths before opening the PR.

## Testing policy

- Changes to pure `src/lib/` logic **require** unit tests in the co-located
  `*.test.ts` file. Bug fixes add a regression test reproducing the exact
  scenario (e.g. "3 people, $50 bill, A paid $30…").
- Run locally before pushing — the same commands CI runs:

  ```bash
  pnpm lint
  pnpm exec tsc --noEmit
  pnpm test
  ```

- `pnpm test:e2e` (Playwright, Mobile Chrome) needs the Docker Postgres up
  and runs single-worker on purpose — the in-memory rate limiter shares
  buckets across parallel tests. Run it when you've touched flows the specs
  cover (auth, expenses, trips, currency, toggles); it is not in CI yet.

## PR checklist

- [ ] Lint, typecheck, and unit tests pass locally
- [ ] New/changed domain logic has unit tests
- [ ] User-facing strings added to both `en.json` and `km.json`
- [ ] Schema change? Migration generated and committed with `drizzle/meta/`
- [ ] Money paths: invariants still asserted by a test
- [ ] Checked on a mobile viewport
- [ ] No secrets in code or fixtures; new env vars documented in
      `.env.example` (with fallback behavior) and DEPLOYMENT.md

## Review expectations

- Review for correctness of money math and authorization first, style
  second.
- At least one approval before merge. The author merges their own PR after
  approval and green CI.
- Big directional changes (new dependency category, schema redesign,
  paid third-party service) get an ADR in [docs/adr/](./docs/adr/) —
  copy `template.md` — and a conversation before the code.
