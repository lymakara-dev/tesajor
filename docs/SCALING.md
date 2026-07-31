# Scaling & Operations Playbook

Where the deployment stands, what breaks first as usage grows, and the
pre-planned fixes. Companion to [DEPLOYMENT.md](../DEPLOYMENT.md) (the
how-to-deploy steps) and [ROADMAP.md](./ROADMAP.md) (when to do these).

## Current shape

- **App**: Vercel serverless (Next.js 15). Stateless per request — except
  the two in-memory caveats below.
- **DB**: Neon Postgres (encrypted at rest, PITR backups on paid plans).
  Local dev: Docker Postgres 16 on port 5433.
- **Media**: Cloudinary when configured; otherwise local disk
  (`public/uploads/`) — **local disk does not work on Vercel** (read-only,
  ephemeral FS), so Cloudinary is effectively required in production.
- **Telegram**: outbound Bot API calls made inline in the server action;
  inbound via webhook.
- **No monitoring, no error tracking, no analytics** yet (ROADMAP P1).

## What breaks first (in likely order)

### 1. In-memory state × multiple instances

Two things assume a single long-lived process:

- `src/lib/rate-limit.ts` — per-process `Map` buckets. On serverless, every
  cold start / concurrent instance gets its own counters, so real limits
  are N× looser than configured.
- Any future cache added the same way.

**Fix**: Upstash Redis (or Vercel KV) with the same
`checkRateLimit(key, limit, windowMs)` signature so call sites don't
change. Do this before any traffic that makes rate limiting matter.

### 2. Balance queries

Balances are recomputed from all of a group's expenses + settlements on
each view. Fine at friend-group scale (tens of expenses); a group with
thousands of rows makes this the hottest query in the app.

**Fix path, in order of effort:**
1. Verify indexes on the hot foreign keys (`expenses.group_id`,
   `expense_payers.expense_id`, `expense_shares.expense_id`,
   `settlements.group_id`) — cheap, do first.
2. Cache computed balances keyed by group + invalidate on any
   expense/settlement mutation (Redis, once it exists for rate limiting).
3. Only if genuinely needed: materialized per-member running balances
   maintained transactionally. Avoid until measurements demand it — it
   duplicates the source of truth the pure functions currently guarantee.

### 3. Synchronous external calls in actions

`requestPaymentsViaTelegram` loops over debtors calling the Bot API inline.
A large group + slow Telegram = a long-running action bumping into
serverless timeouts, and a mid-batch failure leaves a partially sent batch
(mitigated today by idempotent `payment_requests` rows and per-send status).

**Fix**: background jobs (Inngest or Upstash QStash — both fit Vercel).
The action enqueues; the job sends, retries with backoff, and updates
`payment_requests.status`. The same job runner is a prerequisite for
receipt OCR (ROADMAP P3) and scheduled reminders.

### 4. DB connections

Serverless + `postgres.js` can exhaust Postgres connections under burst.
Neon's pooled connection string (PgBouncer) handles this — make sure
`DATABASE_URL` in production is the **pooled** endpoint. Revisit only if
you migrate off Neon.

## Scaling path summary

| Trigger | Action |
|---|---|
| Before multi-instance production traffic | Redis-backed rate limiting; confirm pooled DB endpoint; Cloudinary mandatory |
| First real users | Sentry (error tracking) + uptime check + Neon PITR verified via a restore drill |
| Telegram batches feel slow / OCR work starts | Introduce Inngest/QStash job runner, move sends into jobs |
| Balance views slow (measure first) | FK indexes → cached balances → (last resort) materialized balances |
| Read-heavy growth | Neon read replicas for balance/activity/export reads; writes stay on primary |

## Operational gaps to close (checklist)

- [ ] **Error tracking**: Sentry for server actions, route handlers, and the
      Telegram webhook (webhook failures are currently invisible).
- [ ] **Structured logging**: replace stray `console.*` with a leveled
      logger so Vercel logs are searchable; include group/trip id context.
- [ ] **Backup/restore drill**: Neon PITR exists — actually restore a
      branch once and document the steps here.
- [ ] **Webhook resilience**: Telegram retries failed webhook deliveries;
      confirm the handler is idempotent for duplicate updates (link tokens
      are one-time — good; re-check the "I've paid" callback path).
- [ ] **Uptime monitoring**: a simple external check on `/` and
      `/api/auth/session`.
- [ ] **Secrets hygiene**: rotate `TELEGRAM_WEBHOOK_SECRET` / `AUTH_SECRET`
      procedure documented; secrets only in Vercel env, never in git.

## Cost watchpoints

- **Google Maps**: Maps JavaScript API requires billing enabled. The key is
  browser-exposed by design (`NEXT_PUBLIC_GOOGLE_MAPS_KEY`) — it **must**
  be domain-restricted in Cloud Console. Light usage fits the monthly free
  credit; set a budget alert anyway. Navigation + geolocation features are
  deliberately key-free.
- **Cloudinary**: free tier is generous; client-side compression
  (`compress-image-client.ts`) already minimizes bytes. Watch transformation
  quota if image variants get added.
- **Neon / Vercel**: free tiers carry this app for a long time; the first
  real cost is usually Neon compute hours — enable autosuspend.
- **Telegram Bot API**: free; the constraint is rate limits (~30 msg/s),
  which the job-queue migration naturally respects.
