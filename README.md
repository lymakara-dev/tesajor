# Tesajor

A bill-splitting web app: track shared expenses, see who owes whom, and
settle up with the fewest payments possible. See `CLAUDE.md` for the full
product/technical plan and build phases.

## Stack

Next.js 15 (App Router) + TypeScript, Tailwind CSS + shadcn/ui, PostgreSQL
via Drizzle ORM, Auth.js v5 (email/password + Google), Zod, Vitest.

## Local setup

1. Copy the env file and fill in secrets:

   ```bash
   cp .env.example .env
   ```

   - `AUTH_SECRET`: generate with `openssl rand -base64 33`.
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`: optional for local dev; leave
     blank to disable Google sign-in and use email/password only.
   - `DATABASE_URL` defaults to the Docker Compose Postgres on port 5433
     (5432 is often already taken locally — adjust if needed).

2. Start Postgres:

   ```bash
   docker compose up -d
   ```

3. Run migrations and seed demo data:

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

   Seeds 4 demo users (`anna@example.com` … `dev@example.com`, password
   `password123`) in a group called "Friday Dinner Crew".

4. Start the dev server:

   ```bash
   pnpm dev
   ```

## Telegram setup (optional)

Payment requests over Telegram are fully implemented but disabled by
default — nothing breaks if you skip this section, the relevant buttons
just show a "Telegram isn't configured" message instead of erroring.

1. Message [@BotFather](https://t.me/BotFather) in Telegram, run `/newbot`,
   and follow the prompts. You'll get a bot token
   (`TELEGRAM_BOT_TOKEN`) and a username (`TELEGRAM_BOT_USERNAME`, without
   the `@`).
2. Set `TELEGRAM_WEBHOOK_SECRET` to a random string (e.g.
   `openssl rand -hex 32`) — Telegram echoes this back on every webhook
   call so we can verify requests actually came from Telegram.
3. Register the webhook (needs a public HTTPS URL — use `ngrok` or similar
   for local testing, since Telegram can't reach `localhost`):

   ```bash
   curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
     -d "url=https://<your-domain>/api/telegram/webhook" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```

4. Put all three variables in `.env` and restart the dev server.

With that done: from `/account`, "Connect Telegram" opens a `t.me` deep
link — tapping Start in Telegram lets the bot capture your `chat_id`
(required for messaging you), independent of any login flow. From a
group's Balances page, "Request payments via Telegram" sends each linked
debtor a QR code + amount owed with an inline "I've paid" button; tapping
it creates a pending claim the requester confirms in-app before it
becomes a real settlement.

This was built and unit-tested (HMAC verification, webhook intent parsing,
per-debtor amount computation) and exercised end-to-end against a fake
bot token/webhook secret to verify all the DB-writing logic — but never
against Telegram's real servers, since that needs a registered bot. Try
the flow above once you have real credentials, and expect to debug the
occasional rough edge.

## Scripts

- `pnpm dev` / `pnpm build` / `pnpm start` — Next.js dev/build/start.
- `pnpm lint` — ESLint.
- `pnpm test` — Vitest (unit tests for the money/split/balance math).
- `pnpm test:e2e` — Playwright smoke test (`e2e/`); starts its own dev
  server if one isn't already running on port 3000, and needs the DB from
  step 2 above to be up.
- `pnpm db:generate` — generate a Drizzle migration from `src/db/schema.ts`.
- `pnpm db:migrate` — apply pending migrations.
- `pnpm db:push` — push schema directly (local prototyping only).
- `pnpm db:studio` — Drizzle Studio.
- `pnpm db:seed` — seed demo users/group.

## Architecture

- `src/db/schema.ts` — Drizzle schema: users, groups, group_members,
  expenses (+ payers/shares/items/assignees), settlements, activity_log,
  plus the Auth.js adapter tables.
- `src/lib/auth.ts` — Auth.js v5 config (Credentials + Google, Drizzle
  adapter).
- `src/lib/splits/` — pure expense-splitting math (equal/exact/percent/
  shares/itemized), `src/lib/balances/` — pure net-balance and debt-
  simplification math. Both framework-free with full Vitest coverage.
- `src/lib/actions/` — server actions (mutations), each validated with Zod
  from `src/lib/validation/`.
- `src/app/` — routes: `/`, `/login`, `/register`, `/groups`,
  `/groups/[id]` (+ `expenses/new`, `expenses/[expenseId]/edit`,
  `balances`, `activity`), `/groups/join/[code]`.
- `src/app/api/uploads/` — local receipt/QR-photo upload (saved under
  `public/uploads/`, not committed). Swap for cloud storage before
  production.
- `src/app/api/groups/[id]/export/` — CSV export of a group's expenses.
- `src/lib/telegram/` — pure logic for the Telegram integration: Login
  Widget HMAC verification (`verify.ts`), webhook update parsing
  (`webhook.ts`), and per-debtor amount computation (`amounts.ts`), all
  unit-tested; `client.ts` wraps the Bot API. `src/app/api/telegram/
  webhook/` is the actual webhook route. See "Telegram setup" above.

Money is always stored as integer cents — never floats — per the invariants
in `CLAUDE.md`.
