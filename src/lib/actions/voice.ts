"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { agendaItems, trips, users, voiceClips } from "@/db/schema";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getTripRole } from "@/lib/actions/trip-membership";
import {
  buildPhrase,
  phraseHash,
  type VoiceKind,
  type VoiceLocale,
} from "@/lib/voice/phrases";
import { getTtsConfig, synthesize } from "@/lib/voice/tts";
import { storeVoiceClip } from "@/lib/voice/store";
import { getVoiceClipsSchema, setVoicePreferencesSchema } from "@/lib/validation/voice";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface ItemVoiceClips {
  welcomeUrl: string | null;
  reminderUrl: string | null;
}

/** Cap generation per call so one page open can't drain the TTS quota. */
const MAX_GENERATIONS_PER_CALL = 20;

export async function setVoicePreferences(input: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = setVoicePreferencesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings." };
  }

  await db
    .update(users)
    .set({ voiceEnabled: parsed.data.enabled, voiceLocale: parsed.data.locale })
    .where(eq(users.id, session.user.id));

  revalidatePath("/account");
  return { ok: true, data: undefined };
}

/**
 * Voice clips for a trip day, pre-generated and cached (ADR-0010): looks up
 * `voice_clips` by content hash, synthesizes anything missing when a TTS
 * provider is configured, and returns playable URLs per agenda item. The
 * phone preloads these when the day opens, so the arrival moment needs no
 * connectivity. No TTS key → returns whatever clips already exist (usually
 * none) and the UI degrades to banner + chime.
 */
export async function getVoiceClips(
  input: unknown,
): Promise<ActionResult<{ enabled: boolean; clips: Record<string, ItemVoiceClips> }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = getVoiceClipsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }
  const { tripId, dayNumber } = parsed.data;

  const [me] = await db
    .select({ voiceEnabled: users.voiceEnabled, voiceLocale: users.voiceLocale })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!me?.voiceEnabled) return { ok: true, data: { enabled: false, clips: {} } };
  const locale: VoiceLocale = me.voiceLocale === "en" ? "en" : "km";

  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
  if (!trip) return { ok: false, error: "Trip not found." };
  const role = await getTripRole(tripId, session.user.id);
  if (!role && trip.visibility === "private") {
    return { ok: false, error: "You don't have access to this trip." };
  }

  const items = await db
    .select()
    .from(agendaItems)
    .where(and(eq(agendaItems.tripId, tripId), eq(agendaItems.dayNumber, dayNumber)));
  if (items.length === 0) return { ok: true, data: { enabled: true, clips: {} } };

  // Which (item, kind) pairs should exist? Welcomes for every stop,
  // reminders only for stops with a scheduled start.
  const wanted = items.flatMap((item) => {
    const pairs: { itemId: string; kind: VoiceKind; text: string; hash: string }[] = [
      welcomeSpec(item.id, item.title, locale),
    ];
    if (item.plannedStart) pairs.push(reminderSpec(item.id, item.title, locale));
    return pairs;
  });

  const existing = await db
    .select()
    .from(voiceClips)
    .where(
      and(
        inArray(
          voiceClips.agendaItemId,
          items.map((i) => i.id),
        ),
        eq(voiceClips.locale, locale),
      ),
    );
  const byKey = new Map(
    existing.map((c) => [`${c.agendaItemId}:${c.kind}:${c.textHash}`, c.audioUrl]),
  );

  const ttsConfig = getTtsConfig();
  let generated = 0;
  const clips: Record<string, ItemVoiceClips> = {};
  for (const item of items) clips[item.id] = { welcomeUrl: null, reminderUrl: null };

  for (const spec of wanted) {
    let url = byKey.get(`${spec.itemId}:${spec.kind}:${spec.hash}`) ?? null;

    if (!url && ttsConfig && generated < MAX_GENERATIONS_PER_CALL) {
      if (!checkRateLimit(`voice-gen:${session.user.id}`, 60, 5 * 60 * 1000)) break;
      try {
        generated++;
        const bytes = await synthesize(spec.text, locale, ttsConfig);
        url = await storeVoiceClip(bytes);
        await db
          .insert(voiceClips)
          .values({
            agendaItemId: spec.itemId,
            kind: spec.kind,
            locale,
            textHash: spec.hash,
            audioUrl: url,
          })
          .onConflictDoNothing();
      } catch {
        // Silent mode for this clip — banner + chime still fire client-side.
        url = null;
      }
    }

    if (url) {
      if (spec.kind === "welcome") clips[spec.itemId].welcomeUrl = url;
      else clips[spec.itemId].reminderUrl = url;
    }
  }

  return { ok: true, data: { enabled: true, clips } };
}

function welcomeSpec(itemId: string, title: string, locale: VoiceLocale) {
  const text = buildPhrase("welcome", locale, title);
  return { itemId, kind: "welcome" as const, text, hash: phraseHash(text) };
}

function reminderSpec(itemId: string, title: string, locale: VoiceLocale) {
  const text = buildPhrase("reminder", locale, title);
  return { itemId, kind: "reminder" as const, text, hash: phraseHash(text) };
}
