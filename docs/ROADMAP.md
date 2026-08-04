# Roadmap

Honest status as of July 2026, then the prioritized backlog. The original
phase plan lives in [`CLAUDE.md`](../CLAUDE.md); this document tracks what
actually shipped and what's next. **Features that have a written design
are tracked live on the [plans board](./plans/README.md)** — that's the
place to check what's in flight.

## Where the project stands

| Phase (per CLAUDE.md) | Status | Notes |
|---|---|---|
| 1 · Foundation (schema, auth, groups/invites) | ✅ Done | Placeholder members + claim flow included |
| 2 · Expense engine (5 split methods, multi-payer) | ✅ Done | Pure `src/lib/splits/`, 155 unit tests across the lib modules |
| 3 · Balances & settlement | ✅ Done | Min-cash-flow simplifier, manual settlements, activity feed |
| 4 · Polish (itemized UI, CSV export, mobile, currency) | ✅ Done | Camera capture + client-side image compression added |
| 5 · Commercial | 🟡 Partial | Landing page, `/terms`, `/privacy` shipped. **No Stripe, no analytics, no LICENSE decision** |
| 6 · Telegram payment requests | ✅ Done* | Fully built and unit-tested, but never exercised against Telegram's real servers — needs a real-bot shakedown (README § Telegram setup) |
| 7 · Trip Agenda | ✅ Done* | Complete incl. gamification/templates; embedded-map path never run against a real Maps key |

Shipped beyond the plan: **i18n (English + Khmer)**, **USD↔KHR bi-currency**
with per-group/per-trip rate overrides, **Cloudinary uploads** with
local-disk fallback, **in-memory rate limiting** (`src/lib/rate-limit.ts`),
PWA icons.

## Backlog (prioritized)

### P0 — team-readiness (do before/while adding contributors)

1. **CI baseline** — `.github/workflows/ci.yml` (lint + typecheck + vitest)
   ships with this docs suite. Follow-ups: branch protection on `main`
   requiring the check, PR template.
2. **Real-credentials shakedown** — run the Telegram flow against a real
   bot (webhook, sendPhoto, "I've paid" callback) and the trip map against
   a real Maps key; fix the rough edges both READMEs warn about.
3. **License decision** — repo has no LICENSE file. As a commercial
   product this is probably "all rights reserved" or a source-available
   license, but it's an owner decision; contributors need to know before
   external contributions arrive.

### P1 — hardening

4. **Test coverage beyond pure lib** — server actions (authorization
   bypass attempts, invariant enforcement), the Telegram webhook route,
   and the uploads route currently have zero direct tests. Start with
   `expenses.ts` and the webhook.
5. ~~**E2E in CI**~~ — done 2026-08-04: `ci.yml` gained an `e2e` job with
   a Postgres 16 service container, migrations, and the full Playwright
   suite (specs self-register users and stub external services, so no
   seed is needed); traces upload on failure. First run happens on the
   next push — watch it before relying on the check.
6. **Distributed rate limiting** — the in-memory limiter is per-process;
   move to Upstash Redis before multi-instance deployment
   (see [SCALING.md](./SCALING.md)).
7. **Error monitoring** — no Sentry/observability today; add before real
   users.
8. **Auth.js v5 GA** — currently on `5.0.0-beta.31`; track the stable
   release and upgrade.

### P2 — commercial layer (original Phase 5 remainder)

9. **Stripe Pro tier** — feature-flagged subscription (unlimited groups,
   CSV export, future OCR as Pro). Get an ADR + owner sign-off first
   (paid service).
10. **Analytics** — privacy-respecting product analytics (e.g. Plausible /
    PostHog) for funnel visibility.
11. **Account-deletion audit** — `deleteAccount` exists; verify it
    anonymizes rather than orphans financial rows, and document the GDPR
    story in `/privacy`.

### P3 — product growth

*Designed and ready to build* (full design in
[plans/trip-companion.md](./plans/trip-companion.md), status on the
[board](./plans/README.md)):

- **Trip Companion TC-1 — Explore**: nearby essentials (bathroom, parking,
  food, market, fuel, ATM via OpenStreetMap) + trending places from
  public templates, with one-tap add-to-agenda.
- **Trip Companion TC-2 — Music**: province-aware playlist suggestions
  streamed from the owner's Navidrome server (Subsonic API), mini-player.
- **Trip Companion TC-3 — Routing**: real road routes on the day map +
  follow-along mode (OpenRouteService/OSRM), Google-handoff kept for
  turn-by-turn.
- **Trip Companion TC-4 — Khmer voice**: pre-generated Khmer TTS clips —
  spoken "welcome to [destination]" on arrival + agenda reminders (in-app
  and as Telegram voice messages).

*Ideas (no design yet):*

12. **Receipt OCR** (snap → auto-extract items) — the flagship Pro
    feature; needs a background-job story first (see SCALING.md).
13. **Recurring expenses & reminders.**
14. **More currencies** — the money layer is currently USD/KHR-specific in
    its conversion path; generalize `exchange-rate.ts` when a third
    currency market matters.
15. **Public trip-template gallery** — `public_template` visibility exists;
    build the browse/search surface, potential premium-template
    monetization.
16. **Payment deep links** — PayPal.me/Venmo/local-bank URL schemes beside
    the QR images.

## How to use this document

Treat each numbered item as an epic: before starting one, open an issue (or
ADR for the architectural ones), link it here, and update the status table
when a phase-level item lands. Review the priorities roughly quarterly.
