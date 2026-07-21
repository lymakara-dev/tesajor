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

## Scripts

- `pnpm dev` / `pnpm build` / `pnpm start` — Next.js dev/build/start.
- `pnpm lint` — ESLint.
- `pnpm test` — Vitest.
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
- `src/lib/actions/` — server actions (mutations), each validated with Zod
  from `src/lib/validation/`.
- `src/app/` — routes: `/`, `/login`, `/register`, `/groups`,
  `/groups/[id]`, `/groups/join/[code]`.

Money is always stored as integer cents — never floats — per the invariants
in `CLAUDE.md`.
