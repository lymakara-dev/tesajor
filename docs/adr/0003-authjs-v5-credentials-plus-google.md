# ADR-0003: Auth.js v5 with Credentials + Google (+ Telegram linking)

- **Status**: Accepted (backfilled)
- **Date**: 2026-07-31 (documents a decision made at project start)

## Context

A commercial app needs auth without per-user fees (rules out Clerk/Auth0 at
scale) and with self-hosted data (financial records). Users in the target
market may not have Google accounts, so email/password must work; Telegram
is the dominant messenger, so Telegram linking matters for the
payment-request feature.

## Decision

Auth.js (NextAuth) v5 — currently `5.0.0-beta.31` — with the Drizzle
adapter (`src/lib/auth.ts`): Credentials provider (bcryptjs hashes,
`users.password_hash` nullable for OAuth-only accounts) plus optional
Google OAuth. Telegram is **account linking, not a session provider**: the
Login Widget payload is HMAC-SHA256-verified against the bot token
(`src/lib/telegram/verify.ts`), and a `t.me/<bot>?start=<one-time-token>`
deep link (rows in `telegram_link_tokens`) lets the webhook capture
`chat_id`.

## Consequences

No vendor fees, full data ownership, and Telegram messaging capability
without making Telegram an identity provider. Costs: we own password-reset
and credential security, and we ride a beta — upgrading to Auth.js v5 GA is
a tracked roadmap item. Revisit if operating password auth becomes a
burden (managed auth) or when v5 stabilizes (upgrade).
