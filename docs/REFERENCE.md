# Backend Reference

Index of every mutation entry point, API route, and database table.
Regenerate the actions list any time with:

```bash
grep -n "^export async function" src/lib/actions/*.ts
```

## Server actions (`src/lib/actions/`)

Every action authenticates the caller, parses input with the matching Zod
schema from `src/lib/validation/`, checks group/trip membership, mutates via
Drizzle, and (for group data) writes an `activity_log` row. Most return an
`ActionResult` (`{ ok: true } | { ok: false, error }`).

| File | Exports | What it does |
|---|---|---|
| `auth.ts` | `registerUser` | Email/password registration (bcrypt hash) |
| `account.ts` | `updateProfile`, `deleteAccount` | Profile edits (name synced to `group_members.display_name`), account deletion |
| `groups.ts` | `createGroup`, `joinGroupByInviteCode`, `updateGroupExchangeRate` | Group CRUD, invite-link joining (incl. claiming a placeholder member), per-group USD↔KHR rate override |
| `group-membership.ts` | `requireGroupMemberIds`, `requireUserIsMember` | Shared authorization guards used by other actions (not called from the client) |
| `expenses.ts` | `createExpense`, `updateExpense`, `deleteExpense` | Full expense engine: multi-payer, 5 split methods, itemized line items; enforces Σpaid = Σowed = total; soft delete |
| `settlements.ts` | `recordSettlement` | Record a payment between two members (manual or from a simplify-debts suggestion) |
| `payment-methods.ts` | `addPaymentMethod`, `deletePaymentMethod` | Payment QR images / payment links (QR generated server-side from a link), default flag |
| `payment-requests.ts` | `requestPaymentsViaTelegram`, `confirmPaymentRequest` | Batch-send per-debtor QR + amount via the bot (idempotent, rate-limited); confirm a debtor's "I've paid" claim into a real settlement |
| `telegram.ts` | `createTelegramLinkToken`, `disconnectTelegram`, `linkTelegramViaWidget` | Deep-link token minting, unlinking, Login-Widget linking (HMAC-verified) |
| `trips.ts` | `createTrip`, `joinTripByInviteCode`, `publishTrip`, `cloneTrip`, `updateTripExchangeRate` | Trip CRUD, collaborator joining, template visibility, template cloning (date shift + journal strip) |
| `trip-membership.ts` | `getTripRole` | Shared role lookup used by trip actions |
| `agenda-items.ts` | `addAgendaItem`, `updateAgendaItem`, `reorderAgendaItems`, `completeAgendaItem`, `skipAgendaItem`, `resetAgendaItem` | Agenda CRUD + drag-and-drop ordering + quest completion (server-side XP/achievements) |
| `item-notes.ts` | `addItemNote` | Stop journals: mood 1–5, text, tags, photos, actual cost |
| `places.ts` | `getNearbyPlaces` | Explore tab essentials: cache-first Overpass (OSM) nearby search per grid cell + category, distance-sorted; session-only (no group data touched), rate-limited 30/user/5 min |
| `music.ts` | `linkMusicAccount`, `unlinkMusicAccount`, `getMyPlaylists`, `setProvincePlaylist`, `clearProvincePlaylist`, `getMusicSuggestion`, `getPlaylistQueue` | Navidrome/Subsonic linking (ping-verified; stores salt+token, never the password — ADR-0008), province→playlist mappings, trip-day playlist suggestion, ready-to-play stream queues; link attempts rate-limited 5/user/5 min |
| `routing.ts` | `getDayRoutes` | Road routes between a day's stops: trip-access-checked, cache-first (`route_cache`, no TTL), ORS fetch per missed leg; `legs: null` when `OPENROUTESERVICE_API_KEY` unset (map keeps straight lines); rate-limited 30/user/5 min |
| `voice.ts` | `getVoiceClips`, `setVoicePreferences` | Trip voice companion: per-day clip preload with cache-first generation (`voice_clips` by text hash; skipped without `TTS_PROVIDER`/`TTS_API_KEY`; ≤20 clips/call, rate-limited 60/user/5 min) and per-user voice on/off + locale |
| `locale.ts` | `setLocale` | Persist the en/km locale choice |

## API routes (`src/app/api/`)

| Route | Method(s) | Auth | Purpose |
|---|---|---|---|
| `api/auth/[...nextauth]` | GET/POST | — | Auth.js handlers (sign-in, callbacks, session) |
| `api/groups/[id]/export` | GET | Session + group membership | CSV export of the group's expenses |
| `api/telegram/webhook` | POST | `X-Telegram-Bot-Api-Secret-Token` header must match `TELEGRAM_WEBHOOK_SECRET` | Handles `/start <link-token>` (captures `chat_id`, links account) and "I've paid" callback queries (marks request paid, pending confirmation) |
| `api/uploads` | POST | Session | Image upload: type/size/magic-byte validation → Cloudinary (if configured) or `public/uploads/` |
| `api/cron/voice-reminders` | GET | `Authorization: Bearer` must match `CRON_SECRET` | Vercel cron (every 5 min, `vercel.json`): Telegram voice/text reminders for stops starting within 15 min, send-once per (stop, user) via `voice_reminder_sends` |

## Database tables (`src/db/schema.ts`)

Money columns are always `*_cents` integers. `uuid` PKs throughout unless
noted. Cascade deletes follow ownership (group → its expenses, etc.).

### Identity & auth

| Table | Key columns | Notes |
|---|---|---|
| `users` | `email` (unique), `password_hash` (nullable), `avatar_url`, `default_currency` | `password_hash` null for OAuth-only users |
| `accounts` / `sessions` / `verification_tokens` | — | Standard Auth.js Drizzle-adapter tables; don't hand-edit |

### Groups & expenses

| Table | Key columns | Notes |
|---|---|---|
| `groups` | `base_currency`, `usd_khr_rate` (nullable), `invite_code` (unique) | Null rate falls back to `DEFAULT_USD_TO_KHR_RATE` |
| `group_members` | `user_id` **nullable**, `display_name`, `role` (`owner\|member`) | Nullable user = placeholder member; all money FKs point here, not at `users` |
| `expenses` | `total_amount_cents`, `currency`, `exchange_rate` (decimal string), `split_method`, `receipt_url`, `deleted_at` | Soft-deleted; `updated_at` maintained |
| `expense_payers` | `member_id`, `paid_amount_cents` | Σ paid = total |
| `expense_shares` | `member_id`, `owed_amount_cents`, `share_meta` (jsonb) | Σ owed = total; meta holds percent/share-count/item refs |
| `expense_items` | `name`, `price_cents` | Itemized mode only |
| `item_assignees` | PK (`item_id`, `member_id`) | Who shared each line item |

### Settlement & audit

| Table | Key columns | Notes |
|---|---|---|
| `settlements` | `from_member`, `to_member`, `amount_cents`, `method`, `settled_at` | The only thing that reduces balances besides expense edits |
| `activity_log` | `actor` (nullable user), `action`, `payload_json` | Append-only audit trail per group |

### Telegram

| Table | Key columns | Notes |
|---|---|---|
| `telegram_accounts` | `telegram_user_id` (unique), `chat_id` | `chat_id` required before the bot can message the user |
| `telegram_link_tokens` | `token` (PK), `expires_at` | One-time deep-link tokens; deleted on consumption |
| `payment_methods` | `label`, `qr_image_url`, `payment_link`, `is_default` | The payer's QR/link shown to debtors |
| `payment_requests` | `requester_member`, `debtor_member`, `amount_cents`, `status` (`sent\|delivered\|failed\|paid`), `paid_at`, `confirmed_at`, `settlement_id` | `paid_at` = debtor claim; `confirmed_at` + `settlement_id` = requester confirmed → balances change |

### Trips

| Table | Key columns | Notes |
|---|---|---|
| `trips` | `group_id` (nullable), `visibility` (`private\|link\|public_template`), `invite_code` (unique), `cloned_from_trip_id`, `usd_khr_rate` | Invite code = collaborators; visibility = template cloning |
| `trip_members` | `role` (`owner\|editor\|viewer`), unique (`trip_id`, `user_id`) | Permissions resolved in `src/lib/trips/permissions.ts` |
| `agenda_items` | `day_number`, `sort_order`, `category`, `planned_cost_cents`, `place_id`/`lat`/`lng`, `status` (`todo\|done\|skipped`), `completed_by` | Google place fields optional (manual stops allowed) |
| `item_notes` | `mood` (1–5), `tags[]`, `actual_cost_cents`, `photo_urls[]` | A noted cost can be converted to a group expense in one tap |
| `achievements` | `key`, unique (`user_id`, `key`) | Keys defined in `src/lib/quests/achievements.ts` |

### Places (Explore)

| Table | Key columns | Notes |
|---|---|---|
| `place_cache` | `cell`, `category`, `results_json` (jsonb), `fetched_at`, unique (`cell`, `category`) | Cached Overpass responses per ~0.02° grid cell (`src/lib/places/cache-cell.ts`); ~7-day TTL enforced at read time in `getNearbyPlaces`; public OSM data, no user data |

### Music (Trip Companion)

| Table | Key columns | Notes |
|---|---|---|
| `music_accounts` | `user_id` (unique), `server_url`, `username`, `subsonic_salt`, `subsonic_token` | One linked Subsonic-compatible server per user; token = md5(password+salt), password never stored (ADR-0008); revoked by changing the Navidrome password |
| `province_playlists` | `province_code` (ISO 3166-2:KH), `playlist_id`, `playlist_name`, unique (`user_id`, `province_code`) | Explicit province→playlist choices — first rule in `src/lib/music/suggest.ts`; `playlist_name` denormalized for display |

### Routing (Trip Companion)

| Table | Key columns | Notes |
|---|---|---|
| `route_cache` | `from_lat`/`from_lng`/`to_lat`/`to_lng` (rounded ~10 m), `profile`, `polyline` (jsonb `{lat,lng}[]`), `distance_meters`, `duration_sec`, unique (coords, `profile`) | Road legs between agenda stops (ADR-0009); no TTL — routes between fixed points are static, quota only spent per edited leg |

### Voice (Trip Companion)

| Table | Key columns | Notes |
|---|---|---|
| `voice_clips` | `agenda_item_id` (cascade), `kind` (welcome\|reminder), `locale` (en\|km), `text_hash`, `audio_url`, unique (item, kind, locale, hash) | Pre-generated TTS clips (ADR-0010); hash keys phrase content so renames back-and-forth reuse clips. Per-user prefs live on `users.voice_enabled` / `users.voice_locale` (default km) |
| `voice_reminder_sends` | `agenda_item_id` (cascade), `user_id` (cascade), `sent_at`, unique (item, user) | Idempotency log for the reminder cron — each (stop, user) Telegram reminder sends at most once |

### Enums (7)

`split_method` (equal/exact/percent/shares/itemized) · `group_role` ·
`payment_request_status` · `trip_visibility` · `trip_role` ·
`agenda_item_category` (food/sight/transport/hotel/activity/other) ·
`agenda_item_status` (todo/done/skipped)

## Schema changes

1. Edit `src/db/schema.ts`.
2. `pnpm db:generate` → new SQL file in `drizzle/` (never edit applied
   migrations; add a new one).
3. `pnpm db:migrate` locally; commit schema + migration + `drizzle/meta/`
   together.
4. `pnpm db:push` is for local prototyping only — never against a shared DB.
