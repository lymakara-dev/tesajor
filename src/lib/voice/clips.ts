/**
 * Cache-first voice-clip lookup/generation shared by the getVoiceClips
 * action (day preload) and the reminder cron route. Server-only; not a
 * server action itself — callers own auth.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { voiceClips } from "@/db/schema";
import { buildPhrase, phraseHash, type VoiceKind, type VoiceLocale } from "./phrases";
import { getTtsConfig, synthesize } from "./tts";
import { storeVoiceClip } from "./store";

/**
 * URL of the clip for this stop/kind/locale, generating it when a TTS
 * provider is configured. Null when no clip exists and none can be made —
 * callers degrade (banner + chime in-app, plain text on Telegram).
 */
export async function ensureVoiceClip(params: {
  agendaItemId: string;
  title: string;
  kind: VoiceKind;
  locale: VoiceLocale;
}): Promise<string | null> {
  const text = buildPhrase(params.kind, params.locale, params.title);
  const hash = phraseHash(text);

  const [existing] = await db
    .select({ audioUrl: voiceClips.audioUrl })
    .from(voiceClips)
    .where(
      and(
        eq(voiceClips.agendaItemId, params.agendaItemId),
        eq(voiceClips.kind, params.kind),
        eq(voiceClips.locale, params.locale),
        eq(voiceClips.textHash, hash),
      ),
    )
    .limit(1);
  if (existing) return existing.audioUrl;

  const ttsConfig = getTtsConfig();
  if (!ttsConfig) return null;

  try {
    const bytes = await synthesize(text, params.locale, ttsConfig);
    const url = await storeVoiceClip(bytes);
    await db
      .insert(voiceClips)
      .values({
        agendaItemId: params.agendaItemId,
        kind: params.kind,
        locale: params.locale,
        textHash: hash,
        audioUrl: url,
      })
      .onConflictDoNothing();
    return url;
  } catch {
    return null;
  }
}
