import { timingSafeEqual } from "crypto";
import { and, eq, gt, isNotNull, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  agendaItems,
  telegramAccounts,
  tripMembers,
  users,
  voiceReminderSends,
} from "@/db/schema";
import { sendAudioMessage, sendTextMessage } from "@/lib/telegram/client";
import { buildPhrase, type VoiceLocale } from "@/lib/voice/phrases";
import { ensureVoiceClip } from "@/lib/voice/clips";
import { REMINDER_LEAD_MS, absoluteAudioUrl } from "@/lib/voice/reminders";

function secretMatches(expected: string, provided: string | null): boolean {
  if (!provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

/**
 * Telegram voice reminders for a closed app (TC-4 improvement): finds
 * agenda stops whose planned start is within the next 15 minutes and sends
 * each trip member with voice on + a linked Telegram chat the
 * pre-generated reminder clip (plain text when no clip exists — e.g. no
 * TTS key). `voice_reminder_sends` makes every (stop, user) pair
 * send-at-most-once regardless of cron cadence.
 *
 * Invoked by Vercel cron (see vercel.json); protected by CRON_SECRET,
 * which Vercel passes as `Authorization: Bearer <secret>`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization");
  if (!secret || !secretMatches(`Bearer ${secret}`, provided)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ sent: 0, skipped: "Telegram not configured." });
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_LEAD_MS);
  const dueItems = await db
    .select()
    .from(agendaItems)
    .where(
      and(
        eq(agendaItems.status, "todo"),
        isNotNull(agendaItems.plannedStart),
        gt(agendaItems.plannedStart, now),
        lte(agendaItems.plannedStart, windowEnd),
      ),
    );

  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  let sent = 0;
  let failed = 0;

  for (const item of dueItems) {
    const recipients = await db
      .select({
        userId: users.id,
        voiceLocale: users.voiceLocale,
        chatId: telegramAccounts.chatId,
      })
      .from(tripMembers)
      .innerJoin(users, eq(users.id, tripMembers.userId))
      .innerJoin(telegramAccounts, eq(telegramAccounts.userId, users.id))
      .where(
        and(
          eq(tripMembers.tripId, item.tripId),
          eq(users.voiceEnabled, true),
          isNotNull(telegramAccounts.chatId),
        ),
      );

    const alreadySent = new Set(
      (
        await db
          .select({ userId: voiceReminderSends.userId })
          .from(voiceReminderSends)
          .where(eq(voiceReminderSends.agendaItemId, item.id))
      ).map((r) => r.userId),
    );

    for (const recipient of recipients) {
      if (!recipient.chatId || alreadySent.has(recipient.userId)) continue;

      const locale: VoiceLocale = recipient.voiceLocale === "en" ? "en" : "km";
      const text = buildPhrase("reminder", locale, item.title);
      const clipUrl = await ensureVoiceClip({
        agendaItemId: item.id,
        title: item.title,
        kind: "reminder",
        locale,
      });

      try {
        if (clipUrl) {
          await sendAudioMessage(recipient.chatId, absoluteAudioUrl(clipUrl, baseUrl), text);
        } else {
          await sendTextMessage(recipient.chatId, text);
        }
        await db
          .insert(voiceReminderSends)
          .values({ agendaItemId: item.id, userId: recipient.userId })
          .onConflictDoNothing();
        sent++;
      } catch {
        // Left unrecorded — the next cron tick retries while still in the
        // window.
        failed++;
      }
    }
  }

  return NextResponse.json({ checked: dueItems.length, sent, failed });
}
