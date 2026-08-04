# ADR-0010: Pre-generated Khmer voice clips over live TTS

- **Status**: Accepted
- **Date**: 2026-08-04

## Context

The Khmer voice companion (Trip Companion TC-4) speaks two phrases:
an arrival welcome ("សូមស្វាគមន៍មកកាន់ [stop]") and a 15-minute agenda
reminder. Options for producing speech at the trigger moment:

- **On-device `speechSynthesis`** — free and offline, but many Android/iOS
  builds ship no Khmer voice at all, so the headline feature would silently
  not exist for most users.
- **Live TTS API call at trigger time** — needs connectivity exactly when
  rural Cambodia is most likely to have none (arriving at a remote stop),
  and pays per play.
- **Pre-generate once, play a cached MP3** — the agenda is known ahead of
  time, so every phrase is known ahead of time.

Both hosted providers with documented Khmer neural voices (Azure Speech
`km-KH`, Google Cloud TTS) needed a quality bake-off the plan left open;
most open-source Khmer models (e.g. Meta MMS) are non-commercially
licensed and excluded.

## Decision

Generate each clip **once** server-side and store it through the existing
upload backends (Cloudinary as `resource_type: "video"`, or local disk):
`voice_clips` rows are keyed by `(agenda_item, kind, locale, text_hash)`,
so renaming a stop back and forth reuses old clips, and the phone preloads
a day's clips when the day opens (`getVoiceClips`). Phrase text comes from
templates in the message files (`src/lib/voice/phrases.ts`, pure — no
naive Khmer concatenation).

TTS sits behind a provider interface (`src/lib/voice/tts.ts`) with two
drivers — Azure (needs `TTS_REGION`) and Google — selected by env
(`TTS_PROVIDER`, `TTS_API_KEY`, both optional). This settles the bake-off
by configuration: point the env at either provider and let a native
speaker compare the same phrase. No key → clips simply don't generate and
the client degrades in order: cached clip → on-device `speechSynthesis`
*if* a Khmer/English voice exists → chime + vibration + visual banner.

Arrival detection is a pure debounce state machine
(`src/lib/voice/arrival.ts`: within 100 m for ≥ 10 s, fire once per stop)
fed by Follow mode's existing geolocation loop. In-app reminders run off a
30 s timer while a trip tab is open; **Telegram `sendVoice`/`sendAudio`
delivery for a closed app is deferred** to the cron/job-runner
prerequisite SCALING.md already plans (same one Telegram batch sends
need) — tracked in the trip-companion Improvements list.

## Consequences

- The trigger moment needs zero connectivity and zero API spend; welcome
  phrases are ~30 characters, so even heavy months stay far inside both
  providers' free tiers.
- Clip storage is append-only per unique phrase; orphaned clips of renamed
  stops linger until the agenda item is deleted (cascade) — negligible at
  ~30 KB/clip.
- A stop renamed while offline has no clip for its new name until someone
  opens the day online; the fallback chain covers the gap.
- Voice preferences are per-user (`users.voice_enabled`, `voice_locale`,
  default Khmer) — a group's members can each hear their own language.
