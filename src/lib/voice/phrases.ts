/**
 * Voice phrase assembly for the trip companion. Pure, framework-free.
 *
 * Templates live in the message files (per the i18n playbook) — never
 * naively concatenated, so Khmer word order stays correct. `phraseHash`
 * keys generated clips by content: renaming a stop back and forth reuses
 * the old clip instead of regenerating.
 */
import { createHash } from "crypto";
import enMessages from "../../../messages/en.json";
import kmMessages from "../../../messages/km.json";

export const VOICE_KINDS = ["welcome", "reminder"] as const;
export type VoiceKind = (typeof VOICE_KINDS)[number];

export const VOICE_LOCALES = ["en", "km"] as const;
export type VoiceLocale = (typeof VOICE_LOCALES)[number];

const TEMPLATES: Record<VoiceLocale, Record<VoiceKind, string>> = {
  en: {
    welcome: enMessages.voice.phraseWelcome,
    reminder: enMessages.voice.phraseReminder,
  },
  km: {
    welcome: kmMessages.voice.phraseWelcome,
    reminder: kmMessages.voice.phraseReminder,
  },
};

export function buildPhrase(kind: VoiceKind, locale: VoiceLocale, placeName: string): string {
  return TEMPLATES[locale][kind].replace("{place}", placeName.trim());
}

/** Content hash for `voice_clips.text_hash`. */
export function phraseHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}
