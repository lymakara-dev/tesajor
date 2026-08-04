# AGENTS.md — Operating Manual for AI Coding Agents

Instructions for **any** AI coding agent (Claude Code, Codex, Cursor,
Gemini CLI, Copilot, Aider, …) working in this repository. Reading this
file plus the documents it links is enough to work here the way the
project expects. Tool-specific files (`CLAUDE.md`, `GEMINI.md`,
`.github/copilot-instructions.md`) defer to or extend this one.

## What this project is

Tesajor: a commercial bill-splitting web app (Splitwise problem space) with
Telegram payment requests and a gamified trip planner, targeting the
Cambodian market (English/Khmer UI, USD/KHR money). Next.js 15 App Router +
TypeScript strict, Drizzle ORM + Postgres, Auth.js v5, Zod, Tailwind 4 +
shadcn, next-intl, Vitest + Playwright. **The money math is the product** —
correctness beats everything else.

## Read before you code

In order, as the task requires:

1. `docs/ARCHITECTURE.md` — system map, layering rule, data model,
   invariants. Read this before any non-trivial change.
2. `docs/REFERENCE.md` — lookup table for every server action, API route,
   and DB table.
3. `CONTRIBUTING.md` — code standards, testing policy, PR checklist.
4. `docs/playbooks/` — step-by-step recipes for the recurring task shapes
   (schema change, new server action, new UI text, new domain logic).
   **If a playbook exists for your task, follow it.**
5. `docs/ROADMAP.md` / `docs/SCALING.md` — before proposing new scope or
   infrastructure. `docs/plans/README.md` is the live feature board —
   check it before starting feature work, and flip statuses (board + plan
   doc) in the same PR as the work.
6. `docs/adr/` — before reversing an architectural choice; add a new ADR
   (copy `template.md`) rather than silently diverging.

`CLAUDE.md` at the repo root is the original product plan and domain-rule
spec — authoritative for *domain rules* (split methods, invariants,
Telegram/trip behavior), historical for *status* (docs/ROADMAP.md is
current).

## Environment & commands

```bash
pnpm install                  # pnpm 11, Node >= 20
cp .env.example .env          # then set AUTH_SECRET; see docs/ONBOARDING.md
docker compose up -d          # Postgres 16 on localhost:5433
pnpm db:migrate && pnpm db:seed
pnpm dev                      # http://localhost:3000  (anna@example.com / password123)
```

Verification — run these before declaring any change done (CI runs exactly
these three):

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test
```

`pnpm test:e2e` (Playwright, needs the DB up, single-worker by design) when
you touch flows the specs in `e2e/` cover. Database scripts:
`pnpm db:generate` (new migration from schema), `pnpm db:migrate`,
`pnpm db:studio`. Don't remove the `NODE_OPTIONS` IPv4 flags from
`package.json` scripts — they work around a local DNS/IPv6 hang.

## Hard rules (violating these fails review)

1. **Money is integer cents** (`*_cents` columns, `src/lib/money/cents.ts`).
   Never floats. Invariants that must survive every change:
   Σ payers.paid = Σ shares.owed = expense total; rounding remainders
   distributed deterministically; group balance nets sum to 0.
2. **Never trust the client.** Every mutation is a server action in
   `src/lib/actions/` that: checks the session → parses input with a Zod
   schema from `src/lib/validation/` → verifies group/trip membership →
   writes in a transaction → appends to `activity_log` → `revalidatePath`.
   `src/lib/actions/settlements.ts` is the canonical example of the shape.
3. **Domain logic is pure.** Math/rules go in framework-free modules under
   `src/lib/` with co-located `*.test.ts` — never inline in components or
   actions. XP/permissions/amounts computed client-side are display-only.
4. **Every user-facing string is translated** — added to BOTH
   `messages/en.json` and `messages/km.json`, rendered via next-intl.
5. **Soft-delete expenses** (`deleted_at`); never hard-delete financial
   rows.
6. **Optional services degrade gracefully** (Telegram, Google Maps,
   Cloudinary): a missing env var produces a friendly fallback, never a
   crash.
7. **Schema changes ship with their migration** (`pnpm db:generate`,
   commit `drizzle/` + `drizzle/meta/` together; never edit an applied
   migration).
8. Dependencies MIT/Apache-2.0 only. TypeScript strict, no unexplained
   `any`. Mobile-first UI (primary device is a phone at a restaurant).

## Repo map (orientation)

```
src/app/         routes (RSC pages + API handlers: auth, csv export, telegram webhook, uploads)
src/components/  feature components + components/ui (shadcn)
src/db/          schema.ts (all 27 tables) · seed.ts
src/lib/actions/     the ONLY write path (18 files)
src/lib/validation/  Zod schemas, one file per action domain
src/lib/{money,splits,balances,quests,trips,geo,places,music,routing,voice,telegram}/  pure domain logic + tests
messages/        en.json + km.json translations
drizzle/         generated SQL migrations (committed)
e2e/             Playwright specs
```

## Working style expected of agents

- Prefer editing existing patterns over inventing new ones; find the
  closest existing action/component and mirror its shape.
- Bug fix in domain logic ⇒ add a regression test reproducing the exact
  scenario first.
- Conventional commits (`feat:`, `fix:`, `docs:`, …); one concern per
  branch/PR; never commit directly to `main`.
- Keep the docs true: schema or action changes update `docs/REFERENCE.md`;
  shipped/abandoned roadmap items update `docs/ROADMAP.md`; architectural
  decisions get an ADR. Stale docs are treated as bugs.
- Report honestly: failing tests are reported with output, skipped steps
  are named. Never claim verification you didn't run.

## Definition of done

- [ ] `pnpm lint` + `pnpm exec tsc --noEmit` + `pnpm test` all pass
- [ ] New/changed domain logic has unit tests; money invariants asserted
- [ ] UI strings present in both `en.json` and `km.json`
- [ ] Schema change → migration committed; REFERENCE.md updated
- [ ] No secrets in code; new env vars documented in `.env.example` with
      fallback behavior
- [ ] Relevant docs updated (see "Keep the docs true" above)
