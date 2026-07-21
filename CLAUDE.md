# SplitEase — Bill-Splitting Web App: Build Plan & Claude Code Master Prompt

A plan for a commercial, scalable website that solves the "who owes who" problem when friends eat out together: sometimes one person pays, sometimes two people split the payment, people order different food, and settling up gets messy. This document has two parts: (1) the product and technical plan, and (2) a master prompt you can paste into Claude Code to build it.

---

## Part 1 — Product & Technical Plan

### 1. The core problem, stated precisely

Every hangout produces one or more **expenses**. Each expense can have:

- **One or more payers** (e.g., you paid $30 and your friend paid $20 toward one $50 bill).
- **One or more participants**, each owing a different amount because they ordered different food.
- Different **split methods**: exact amounts per person, equal split, percentage, shares (e.g., 2 portions vs 1), or itemized (assign each menu item to whoever ate it, then split tax/tip proportionally).

Across many hangouts, debts pile up in every direction. The app must **net everything into a running balance per person** and then compute the **minimum number of payments** needed to settle the group (debt simplification). That covers every scenario you described.

### 2. Core features (MVP)

1. **Accounts & auth** — email/password + Google sign-in.
2. **Groups** — create a group (e.g., "Friday Dinner Crew"), invite friends via link. Friends without accounts can be added as "placeholder members" and claim their spot later.
3. **Add expense** with:
   - Title, date, category, optional receipt photo.
   - Multiple payers with amounts (must sum to the total).
   - Split methods: **equal / exact amounts / percentages / shares / itemized**.
   - Itemized mode: list items with prices, tag who shared each item; tax + tip split proportionally to each person's subtotal.
4. **Balances view** — who owes whom, net, per group and overall.
5. **Settle up** — record a payment between two people; "Simplify debts" button that minimizes the number of transactions.
6. **Activity feed & history** — every expense and settlement, editable with an audit trail.
7. **Multi-currency** (store currency per expense; one base currency per group for MVP).
8. **Telegram payment requests** — the payer connects their Telegram and uploads their payment QR (bank QR, PromptPay, PayPal, etc.). One click on "Request payments" sends each debtor a personal Telegram message containing the payer's QR image and the exact amount that person owes. Includes "Sign in with Telegram" / account linking. (Full design in section 6b.)
9. **Trip Agenda (gamified travel planner)** — plan a trip as a day-by-day agenda of stops, complete each stop like a game quest (progress, XP, badges), journal on each stop (mood, environment, scenery, food/ticket prices, photos), share agendas as templates others can clone or co-edit, and follow the route live with Google Maps ("you are here → next stop"). Noted prices convert into group expenses in one tap, connecting the planner to the split engine. (Full design in section 6c.)

### 3. Post-MVP (commercial roadmap)

- Receipt OCR (snap a photo → auto-extract items) — a strong Pro feature.
- Recurring expenses (rent, subscriptions), reminders/notifications, expense comments.
- Export to CSV/PDF, charts of spending by category/person.
- Payment deep links (PayPal.me, Venmo, local bank QR).
- **Monetization**: free tier (unlimited basic splits, 1–3 groups) + Pro subscription via Stripe (OCR, unlimited groups, exports, no ads). This is the proven Splitwise model.

### 4. Tech stack (scalable, commercial-friendly, all MIT/Apache licensed)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | One codebase for UI + API, easy to deploy, huge ecosystem, SSR for SEO on marketing pages |
| UI | Tailwind CSS + shadcn/ui | Fast to build, professional look, mobile-first |
| Database | **PostgreSQL** (Neon or Supabase in prod, Docker locally) | Relational data (users↔groups↔expenses) fits SQL perfectly; scales far |
| ORM | Drizzle (or Prisma) | Type-safe queries, migrations |
| Auth | Auth.js (NextAuth v5) | Email + OAuth, self-hosted, no per-user fees |
| Validation | Zod | Shared client/server validation of money math |
| Payments (later) | Stripe | Subscriptions for Pro tier |
| Hosting | Vercel (app) + Neon (DB) | Serverless autoscaling, near-zero cost at small scale |
| Testing | Vitest + Playwright | The split/settlement math **must** be unit-tested |

Scalability path: this stack serves thousands of users on free/cheap tiers; when you grow, you add read replicas, Redis caching for balance queries, and background jobs (e.g., Inngest) for OCR/notifications — no rewrite needed.

### 5. Data model (the heart of correctness)

**Rule #1: store all money as integers in minor units (cents). Never floats.**

```
users            id, name, email, avatar_url, default_currency, created_at
groups           id, name, base_currency, invite_code, created_by, created_at
group_members    id, group_id, user_id (nullable for placeholders),
                 display_name, role, joined_at
expenses         id, group_id, title, total_amount_cents, currency,
                 exchange_rate, category, note, receipt_url, expense_date,
                 split_method (equal|exact|percent|shares|itemized),
                 created_by, created_at, updated_at, deleted_at
expense_payers   id, expense_id, member_id, paid_amount_cents
expense_shares   id, expense_id, member_id, owed_amount_cents,
                 share_meta (json: percent, share count, or item refs)
expense_items    id, expense_id, name, price_cents          -- itemized mode
item_assignees   item_id, member_id                         -- who shared item
settlements      id, group_id, from_member, to_member,
                 amount_cents, method, note, settled_at
activity_log     id, group_id, actor, action, payload_json, created_at

-- Telegram integration
telegram_accounts id, user_id, telegram_user_id (unique), chat_id,
                  username, linked_at
payment_methods   id, user_id, label ("KBank QR", "PayPal"...),
                  qr_image_url, payment_link, is_default, created_at
payment_requests  id, group_id, requester_member, debtor_member,
                  amount_cents, payment_method_id, status
                  (sent|delivered|failed|paid), telegram_message_id,
                  sent_at, paid_at

-- Trip agenda
trips             id, group_id (nullable), owner_id, title, description,
                  cover_url, start_date, end_date, base_currency,
                  visibility (private|link|public_template),
                  cloned_from_trip_id, created_at
trip_members      id, trip_id, user_id, role (owner|editor|viewer)
agenda_items      id, trip_id, day_number, sort_order, title,
                  category (food|sight|transport|hotel|activity|other),
                  planned_start, planned_end, planned_cost_cents, currency,
                  place_name, place_id (Google), lat, lng, address,
                  status (todo|done|skipped), completed_at, completed_by
item_notes        id, agenda_item_id, author_id, mood (1-5 emoji scale),
                  note_text, tags (environment|scenery|food|price|tip),
                  actual_cost_cents, photo_urls[], created_at
achievements      id, user_id, key ("first_trip","day_streak_3",
                  "all_stops_done","early_bird"...), earned_at
```

Invariants (enforce in code + DB constraints):
- Σ `paid_amount_cents` = `total_amount_cents` for every expense.
- Σ `owed_amount_cents` = `total_amount_cents` for every expense.
- Rounding remainders (e.g., $10 ÷ 3) are distributed deterministically: give the extra cents to the first N participants sorted by member id, so totals always reconcile.

### 6. The two key algorithms

**Balance calculation.** For each member: `net = Σ paid − Σ owed + Σ settlements received... ` more precisely `net = (total paid) − (total owed) − (settlements sent) + (settlements received)`. Positive net = the group owes them; negative = they owe the group. Sum of all nets is always 0 — assert this in tests.

**Debt simplification (min-cash-flow).** Split members into creditors (net > 0) and debtors (net < 0). Greedily match the largest debtor with the largest creditor, create a transaction for `min(|debt|, credit)`, update, repeat. This yields at most *n−1* transactions and turns a spaghetti of debts into "A pays B $12, C pays B $5." Show these as *suggested* settlements the users confirm.

### 6b. Telegram QR payment-request feature (design)

**How Telegram works here (two pieces, one bot):**

1. **Sign in / link with Telegram** — create a bot with @BotFather; the official **Telegram Login Widget** lets users sign in or link their account. The widget returns the user's Telegram id + a hash you must verify server-side with HMAC-SHA256 using the bot token (reject anything unverified or older than ~1 day).
2. **Sending messages** — a bot can only message users who have **started a chat with it**. So linking flow is: user clicks "Connect Telegram" → app opens `t.me/YourBot?start=<one-time-token>` → user taps Start → bot webhook receives the token, matches it to the account, and stores the `chat_id`. Now the app can message them.

**Payer setup:** in profile settings, upload one or more payment QRs (image of their bank/PromptPay/PayPal QR) or a payment link (the app can also *generate* a QR from a link). Mark one as default.

**One-click flow:** on the Balances screen, the person who is owed money taps **"Request payments via Telegram"** →
1. Server computes exactly what each member owes them (using simplified balances, or per-expense amounts if requesting for a single expense).
2. For each debtor with a linked Telegram, the bot calls `sendPhoto` with the payer's QR image and a caption like: *"🍜 Friday Dinner Crew — you owe Anna $12.50. Scan the QR to pay, then tap ✅."* with an inline **"✅ I've paid"** button.
3. Tapping the button hits the bot webhook → creates a *pending* settlement the payer confirms in-app (protects against accidental/false confirmations).
4. Debtors without linked Telegram fall back to a shareable link the payer can paste anywhere; the app also nudges them to connect.
5. Every send is recorded in `payment_requests` with delivery status; a debtor is never messaged more than once per request batch (idempotency key).

**Safety/abuse rules:** only members of the same group can be messaged; rate-limit request batches (e.g., max 1 per group per hour); users can disconnect Telegram anytime; store the bot token only in server env vars.

### 6c. Trip Agenda — gamified travel planner (design)

**Planning.** A trip has days; each day has ordered agenda items (stops): a place, category, planned time window, and planned cost (food, ticket, transport). Adding a stop uses **Google Places Autocomplete**, which stores the place_id + coordinates so the map features work automatically. Drag-and-drop reordering; a trip can be linked to a group so costs flow into the split engine.

**Play it like a game.** During the trip, the current day renders as a quest list. Checking off a stop marks it done with a satisfying animation and awards XP; a progress bar fills per day and per trip. Achievements unlock for things like completing a full day, a 3-day streak, first trip finished, or journaling every stop. Skipped stops are allowed (no punishment — travel plans change). All gamification is server-computed (a pure `src/lib/quests/` module, unit-tested) so it can't be spoofed.

**Journal on every stop.** Each stop accepts notes from any trip member: a 1–5 mood emoji, free text about how they felt, the environment and scenery, photos, and **actual prices paid** (food, tickets). Tags make notes filterable later ("show all food prices from this trip"). One tap turns a noted price into a group expense — payer and split method pre-filled — which is the bridge between the planner and the bill-splitting core.

**Templates & sharing.** A trip can be published as a template (visibility: private / share-link / public). Other users can **"Use this template"** (clone it into their own editable trip, dates shifted to their start date, journals stripped, `cloned_from_trip_id` recorded) or be invited as **editors** on the original for real co-planning (roles: owner / editor / viewer). Popular public templates become a growth + Pro monetization surface (e.g., premium curated templates).

**Google Maps integration.**
- **Map view per day**: all stops pinned, route drawn between them in order (Directions API or simple polyline for MVP).
- **"You are here"**: browser Geolocation API shows the user's live position on the day's map and highlights the nearest upcoming stop.
- **"Navigate to next stop"** button: opens the Google Maps app/site with a universal directions URL (`https://www.google.com/maps/dir/?api=1&destination=...&destination_place_id=...`) — turn-by-turn stays in Google's app, so you avoid heavy API cost.
- APIs needed: Maps JavaScript API, Places API (autocomplete), optionally Directions API. Requires a Google Cloud key with billing enabled — restrict the key by domain, keep server-side calls behind env vars, and cache place details to control cost (Google gives a monthly free usage credit; light usage typically stays inside it, but confirm current pricing before launch).

### 7. Build phases

1. **Phase 1 — Foundation**: repo setup, DB schema + migrations, auth, group create/join via invite link.
2. **Phase 2 — Expense engine**: add/edit/delete expenses with all 5 split methods, multiple payers, the rounding logic, and full unit tests of the math.
3. **Phase 3 — Balances & settlement**: balances view, simplify-debts algorithm, record settlements, activity feed.
4. **Phase 4 — Polish**: itemized receipt UI, mobile-responsive design, empty states, currency display, CSV export.
5. **Phase 5 — Commercial**: Stripe subscription, landing page, terms/privacy pages, analytics, deploy to production.
6. **Phase 6 — Telegram integration**: bot setup, Sign in with Telegram + account linking, payment-method QR uploads, one-click payment requests with per-debtor amounts, "I've paid" confirmations, delivery tracking. (Can be built any time after Phase 3, since it depends on balances.)
7. **Phase 7 — Trip Agenda**: trips, day-by-day agenda with Places autocomplete, gamified completion (XP, progress, achievements), stop journals (mood, notes, photos, actual prices → one-tap expense), template publish/clone/co-edit, Google Maps day view with live position and navigate-to-next-stop. (Depends only on Phase 1–2; can run in parallel with 5–6.)

### 8. Commercial checklist

- All dependencies MIT/Apache-2.0 (the stack above is) → safe for commercial use.
- Write your own Terms of Service + Privacy Policy; the app stores personal financial data, so add: encrypted DB at rest (Neon/Supabase default), soft-deletes, account-deletion endpoint (GDPR-style), and rate limiting on auth routes.
- Own the brand: pick a unique name/domain before launch (check trademarks — don't ship it as "Splitwise clone").

---

## Part 2 — Claude Code Master Prompt

Paste everything in the box below as your first message to Claude Code in an empty project folder. Then use the phase prompts that follow, one at a time.

```
You are building "SplitEase", a production-grade, commercial bill-splitting
web app (similar problem space to Splitwise). Friends share meal expenses
where sometimes one person pays, sometimes multiple people pay parts of one
bill, and each person may owe a different amount because they ordered
different food. The app nets all debts and suggests the minimum payments to
settle up.

## Tech stack (do not substitute without asking)
- Next.js 15 App Router, TypeScript strict mode, Tailwind CSS, shadcn/ui
- PostgreSQL via Drizzle ORM (local dev: Docker compose; prod: Neon)
- Auth.js (NextAuth v5): email/password (bcrypt) + Google OAuth
- Zod for all input validation, shared between client and server
- Vitest for unit tests, Playwright for a few E2E smoke tests
- All money stored as integer cents (minor units). NEVER use floats for money.

## Domain rules (critical — implement exactly)
1. An expense has: total_amount_cents, currency, date, category, note,
   split_method, one or more PAYERS (member + paid_amount_cents), and one or
   more SHARES (member + owed_amount_cents).
2. Split methods: equal, exact, percent, shares, itemized.
   - itemized: expense has line items with prices; each item is assigned to
     one or more members; tax and tip are split proportionally to each
     member's item subtotal.
3. Invariants enforced server-side on every create/update:
   - sum(payers.paid) == total
   - sum(shares.owed) == total
   - Rounding remainders distributed deterministically (extra cents to
     lowest member ids) so sums always reconcile.
4. Balances: net(member) = paid − owed − settlements_sent +
   settlements_received. Sum of nets in a group must equal 0 (assert in tests).
5. Debt simplification: greedy min-cash-flow matching largest debtor to
   largest creditor, producing ≤ n−1 suggested transactions. Users confirm
   suggestions to record real settlements.
6. Groups support placeholder members (no account yet) who can later claim
   their identity via invite link.
7. Soft-delete expenses (deleted_at) and log every mutation to activity_log.
8. Telegram (built in Phase 6): users can sign in with Telegram (Login
   Widget, HMAC-verified with the bot token) or link Telegram to an existing
   account via t.me deep link with a one-time token; the bot stores chat_id.
   Users upload payment-method QRs. A "Request payments" action sends each
   debtor a Telegram photo message (their QR + exact owed amount + group
   name) with an inline "I've paid" button that creates a pending settlement
   the requester confirms. Only same-group members can be messaged;
   idempotent batches; rate-limited; bot token server-side only.
9. Trip Agenda (built in Phase 7): trips contain day-numbered, ordered
   agenda items with a Google place_id/lat/lng, planned time and planned
   cost. Items are completed like game quests: server-side XP, per-day and
   per-trip progress, achievement unlocks (pure tested module — never trust
   client for XP). Any trip member can journal on an item: mood 1-5, text,
   tags (environment|scenery|food|price|tip), photos, actual_cost_cents;
   one tap converts a noted cost into a group expense with prefilled payer.
   Trips can be published as templates (private|link|public); cloning
   copies structure, shifts dates, strips journals, records
   cloned_from_trip_id; invited members get owner|editor|viewer roles.
   Maps: Places Autocomplete on item create, per-day map with pinned route,
   live "you are here" via browser geolocation, and a "navigate to next
   stop" button using the universal Google Maps directions URL. Restrict
   the Maps API key by domain; cache place details.

## Engineering standards
- Server actions or API routes with Zod validation; never trust client math.
- All money math in a pure, framework-free module: src/lib/money/ and
  src/lib/splits/ with exhaustive unit tests (equal splits with remainders,
  multi-payer, percent rounding, itemized with shared items + tax/tip,
  simplification edge cases: zero balances, single debtor, ties).
- Mobile-first responsive UI; the primary use case is people on phones at a
  restaurant table.
- Accessible components, loading/empty/error states everywhere.
- No GPL/AGPL dependencies; MIT/Apache-2.0 only (commercial product).
- Environment config via .env with a documented .env.example.
- Write a README with setup, architecture overview, and deployment steps
  (Vercel + Neon).

## Working style
- Before writing code for each phase, present a short plan and the file
  structure you intend to create, then implement.
- After implementing money/split logic, run the unit tests and show results.
- Keep commits logical per feature (conventional commits).
- Ask me before adding any paid third-party service.

Start with Phase 1 now: scaffold the project, Docker compose for Postgres,
Drizzle schema + migrations for users, groups, group_members, expenses,
expense_payers, expense_shares, expense_items, item_assignees, settlements,
activity_log; then implement auth (email + Google) and group creation with
invite-link joining. Seed script with 4 demo users and one demo group.
```

### Follow-up phase prompts (send one after the previous phase works)

**Phase 2:**
```
Implement the expense engine: create/edit/soft-delete expenses supporting all
five split methods (equal, exact, percent, shares, itemized) and multiple
payers. Build the pure calculation module first with full Vitest coverage of
the invariants and rounding rules, then the UI: an "Add expense" flow
optimized for mobile — pick payers and amounts, pick split method, assign
items in itemized mode with proportional tax/tip. Show validation errors when
payer or share sums don't match the total.
```

**Phase 3:**
```
Implement balances and settlement: a Balances tab showing each member's net
and pairwise "who owes whom", a "Simplify debts" action using the min-cash-flow
algorithm that proposes minimal transactions, confirming a proposal records a
settlement, plus a manual "record payment" form and a group activity feed from
activity_log. Unit-test the simplifier including edge cases.
```

**Phase 4:**
```
Polish pass: responsive audit on mobile widths, empty states, currency
formatting via Intl.NumberFormat, receipt image upload, CSV export of a
group's expenses, and Playwright smoke tests covering: sign up → create group
→ invite → add multi-payer itemized expense → simplify → settle.
```

**Phase 5:**
```
Commercial layer: marketing landing page, /terms and /privacy pages,
Stripe subscription for a Pro tier (feature-flag gated: unlimited groups +
CSV export as Pro), account deletion endpoint that anonymizes personal data,
rate limiting on auth routes, and a production deployment guide for
Vercel + Neon including required environment variables.
```

**Phase 6 (Telegram payment requests):**
```
Implement the Telegram integration per domain rule 8. Steps:
1. Schema: telegram_accounts, payment_methods, payment_requests tables
   (see plan). Migration + Drizzle models.
2. "Sign in with Telegram" using the official Login Widget; verify the
   auth hash server-side (HMAC-SHA256 with bot token, reject stale
   auth_date). Support both fresh sign-in and linking to an existing
   logged-in account. Also support linking via t.me/<bot>?start=<token>
   deep link handled by a webhook route (/api/telegram/webhook) so we
   capture chat_id.
3. Profile settings: upload payment QR images (or paste a payment link and
   generate a QR server-side with a QR library), set a default method.
4. Balances screen: "Request payments via Telegram" button. Server action
   computes per-debtor amounts from simplified balances, then for each
   linked debtor calls Telegram sendPhoto with the QR, a caption including
   group name and exact amount, and an inline "I've paid" button.
   Unlinked debtors get a copyable fallback link. Record every send in
   payment_requests with status; make batches idempotent.
5. Webhook handles the "I've paid" callback: create a pending settlement
   the requester confirms in-app before it affects balances.
6. Guards: only same-group members, rate-limit 1 batch/group/hour,
   TELEGRAM_BOT_TOKEN only in server env, webhook secret validation.
7. Tests: hash verification, amount computation per debtor, idempotency,
   webhook callback -> pending settlement. Document bot setup with
   @BotFather (commands, domain for login widget, webhook URL) in README.
```

**Phase 7 (Trip Agenda):**
```
Implement the Trip Agenda per domain rule 9. Steps:
1. Schema: trips, trip_members, agenda_items, item_notes, achievements
   (see plan). Migration + Drizzle models.
2. Trip CRUD: create trip (optionally linked to a group), day tabs,
   add/edit/reorder agenda items with drag-and-drop. Item form uses Google
   Places Autocomplete and stores place_id, lat, lng, address; also allow
   manual items with no place. Planned cost + currency per item.
3. Gamification: pure module src/lib/quests/ computing XP per completion,
   per-day and per-trip progress, and achievement unlocks (first_trip,
   full_day_done, streaks, journaled_every_stop). Server actions award XP;
   client only displays. Completion UI: tap-to-complete with animation,
   progress bars, achievement toasts. Unit-test the quest module.
4. Journals: on each item, any trip member can add mood (1-5), text, tags
   (environment|scenery|food|price|tip), photos, and actual_cost_cents.
   "Add to group expenses" button opens the expense form prefilled with
   amount, title, and payer = note author (only when trip is group-linked).
   Filterable notes view (e.g., all food prices for the trip).
5. Templates & sharing: publish trip as private|link|public template;
   "Use this template" clones structure into the viewer's account with
   dates shifted to their chosen start date and journals stripped;
   invite collaborators as editor/viewer with enforced permissions.
6. Maps: per-day map (Maps JavaScript API) with numbered pins and route
   polyline, live user position via browser geolocation with permission
   prompt and graceful fallback, highlight nearest upcoming stop, and a
   "Navigate to next stop" button opening the universal Google Maps
   directions URL. Key restricted by domain; cache Place Details in DB.
   Env vars: NEXT_PUBLIC_GOOGLE_MAPS_KEY (browser, domain-restricted) and
   GOOGLE_MAPS_SERVER_KEY if server calls are needed.
7. Tests: quest/XP logic, clone-template date shifting and journal
   stripping, permission checks (viewer cannot edit), and a Playwright
   flow: create trip -> add 3 stops -> complete a day -> journal with a
   price -> convert to expense.
```

---

## Tips for working with Claude Code on this project

1. Do the phases in order and don't move on until the tests pass — the money math is the product; everything else is UI.
2. When something looks wrong, paste the exact scenario as a test case ("3 people, bill $50, A paid $30, B paid $20, A ate $25, B ate $15, C ate $10") and ask Claude Code to add it to the unit tests.
3. Keep the master prompt's domain rules in a `CLAUDE.md` file at the repo root so every future session retains the rules — ask Claude Code to create it from the prompt in its first response.