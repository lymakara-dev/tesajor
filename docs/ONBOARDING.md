# Onboarding

Day-1 guide for a new developer. Goal: running app in ~15 minutes, oriented
in the codebase by the end of the day.

## 1. Get it running

Prerequisites: Node ≥ 20, pnpm (via `corepack enable`), Docker.

```bash
git clone <repo-url> tesajor && cd tesajor
pnpm install
cp .env.example .env          # then set AUTH_SECRET (openssl rand -base64 33)
docker compose up -d          # Postgres 16 on port 5433 (5432 is often taken)
pnpm db:migrate
pnpm db:seed                  # 4 demo users + "Friday Dinner Crew" group
pnpm dev                      # http://localhost:3000
```

Log in as `anna@example.com` / `password123` (also `ben@`, `cara@`,
`dev@` — all `@example.com`, same password).

**Env vars — what's actually required:** only `DATABASE_URL` and
`AUTH_SECRET`. Everything else is optional with a graceful fallback:

| Vars | Without them | Docs |
|---|---|---|
| `AUTH_GOOGLE_ID/SECRET` | Google sign-in hidden; email/password works | README |
| `TELEGRAM_BOT_TOKEN/USERNAME`, `TELEGRAM_WEBHOOK_SECRET` | Telegram buttons show "not configured" | README § Telegram setup |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Trip day-map renders as a plain stop list; navigation/geolocation still work | README § Trip Agenda & Maps |
| `CLOUDINARY_*` (all three) | Uploads go to `./public/uploads` on disk | README § File uploads |

Quirk you'll see in `package.json`: dev/build/db scripts set
`NODE_OPTIONS="--no-network-family-autoselection --dns-result-order=ipv4first"`
— a workaround for IPv6-first DNS resolution hanging local Postgres/Next
connections on some Linux setups. Leave it alone.

Verify your setup like CI would:

```bash
pnpm lint && pnpm exec tsc --noEmit && pnpm test
```

## 2. Understand the domain (30 minutes)

The product nets shared expenses and suggests minimum settlement payments.
Two sentences carry most of the domain:

> Every expense has payers (who put money in) and shares (who owes what),
> both summing exactly to the total in integer cents. A member's balance is
> `paid − owed − settlementsSent + settlementsReceived`, and greedy
> min-cash-flow matching turns the group's balances into ≤ n−1 suggested
> payments.

Read these five files **in this order** — they teach the codebase's shape:

1. `src/db/schema.ts` — the whole data model in one file (22 tables,
   commented where it's subtle).
2. `src/lib/splits/calculate.ts` (+ its `.test.ts`) — how a total becomes
   per-member owed amounts across the 5 split methods, and how rounding
   remainders are handled deterministically.
3. `src/lib/balances/calculate.ts` — net balances and debt simplification.
4. `src/lib/actions/expenses.ts` — a representative server action: session →
   Zod parse → membership check → invariant enforcement → Drizzle writes →
   activity log. Every mutation in the app follows this pattern.
5. `src/app/groups/[id]/page.tsx` — a representative RSC page: server-side
   reads, client components only where interactivity needs them.

Then skim [ARCHITECTURE.md](./ARCHITECTURE.md) (system map) and keep
[REFERENCE.md](./REFERENCE.md) open as a lookup table.

## 3. Click around with intent (20 minutes)

With the seeded data: open *Friday Dinner Crew* → add an **itemized**
expense with two payers → watch the Balances tab change → hit **Simplify
debts** → record one suggested settlement → check the Activity feed logged
all of it. That round-trip touches ~80% of the core code paths. Then create
a trip, add a few stops, and complete one to see the quest/XP side.

Switch the language to Khmer (km) once — it explains why every string in
the code goes through `next-intl` and why money handles USD and KHR.

## 4. Good first tasks

- Add a missing translation or fix an en/km string mismatch — teaches the
  i18n pipeline end to end.
- Add a unit-test case to `src/lib/splits/calculate.test.ts` from a real
  scenario (pick an awkward one: $10 ÷ 3, multi-payer percent split).
- Pick a "coverage gap" item from [ROADMAP.md](./ROADMAP.md) — e.g. a first
  test for a server action.
- Any `good-first-issue` on the tracker.

Before your first PR, read [CONTRIBUTING.md](../CONTRIBUTING.md) — the
non-negotiables (integer cents, Zod on every action, both locales) are
enforced in review.
