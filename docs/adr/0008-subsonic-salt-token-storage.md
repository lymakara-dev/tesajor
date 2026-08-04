# ADR-0008: Subsonic salt+token storage for music accounts (no passwords)

- **Status**: Accepted
- **Date**: 2026-08-04

## Context

Location-aware music (Trip Companion TC-2) links a user's Navidrome server
via the Subsonic REST API, whose token auth scheme is
`t = md5(password + salt)` sent with the salt on every request. To call the
API on the user's behalf we must persist *some* credential. Options:

- **Store the password** (encrypted or not) — lets us re-derive tokens with
  fresh salts per request, but makes us a password store for a third-party
  system; a DB leak exposes credentials users likely reuse.
- **Store one salt + token pair** — the pair is a valid API credential
  (whoever holds it can call the Subsonic API), but it is not the password:
  it can't be tried against other services, and changing the Navidrome
  password invalidates it immediately.
- OAuth-style scoped tokens — Subsonic/Navidrome has no such mechanism.

The client also needs stream/cover-art URLs for a plain `<audio>` element,
and Subsonic embeds the auth pair in those URLs — so the pair reaches the
user's own browser either way; only proxying every audio byte through our
server would avoid that, at real bandwidth cost for zero confidentiality
gain (it's the user's own credential).

## Decision

`linkMusicAccount` verifies the password once against `/rest/ping`, then
stores only `subsonic_salt` + `subsonic_token` in `music_accounts`
(`makeSubsonicAuth` in `src/lib/music/subsonic.ts`). The password never
touches the database or logs. Server URLs must be HTTPS (mixed-content
audio is blocked anyway); http is accepted only for localhost dev. Audio
streams directly from the user's server to their device — our server never
proxies bytes. The linking action is rate-limited so it can't be used to
probe third-party servers from our IP. Unlinking deletes the pair and the
user's province→playlist mappings.

## Consequences

- A DB leak exposes revocable, service-scoped API tokens, not passwords;
  the documented remedy is "change your Navidrome password".
- Because the stored salt is fixed per account, requests are linkable by
  salt — acceptable for a self-hosted music server.
- md5 is mandated by the Subsonic protocol; it is not used for anything
  else in the app and is not a password hash here (the token *is* the
  credential).
- If Navidrome grows real API keys, swapping the stored pair for one is a
  column rename away.
