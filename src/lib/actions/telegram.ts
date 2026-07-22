"use server";

import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { telegramAccounts, telegramLinkTokens } from "@/db/schema";
import { auth } from "@/lib/auth";
import { verifyTelegramAuth } from "@/lib/telegram/verify";
import {
  telegramWidgetAuthSchema,
  type TelegramWidgetAuthInput,
} from "@/lib/validation/telegram";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const LINK_TOKEN_TTL_MS = 15 * 60 * 1000;

/**
 * Starts the deep-link flow: user taps the returned t.me link, taps Start
 * in Telegram, and the webhook (src/app/api/telegram/webhook) matches the
 * token back to this account and captures the chat_id needed to message
 * them.
 */
export async function createTelegramLinkToken(): Promise<
  ActionResult<{ deepLinkUrl: string }>
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) {
    return { ok: false, error: "Telegram isn't configured on this server yet." };
  }

  const token = randomUUID();
  await db.insert(telegramLinkTokens).values({
    token,
    userId: session.user.id,
    expiresAt: new Date(Date.now() + LINK_TOKEN_TTL_MS),
  });

  return { ok: true, data: { deepLinkUrl: `https://t.me/${botUsername}?start=${token}` } };
}

export async function disconnectTelegram(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  await db.delete(telegramAccounts).where(eq(telegramAccounts.userId, session.user.id));
  return { ok: true, data: undefined };
}

/**
 * Links Telegram to the current session via the Login Widget's signed
 * payload. This verifies identity but does NOT provide a chat_id (Telegram
 * only gives that once the user has started a chat with the bot), so
 * messaging still requires the deep-link flow above.
 */
export async function linkTelegramViaWidget(
  input: TelegramWidgetAuthInput,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = telegramWidgetAuthSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid Telegram authorization data." };
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return { ok: false, error: "Telegram isn't configured on this server yet." };
  }

  const verification = verifyTelegramAuth(parsed.data, botToken);
  if (!verification.ok) {
    return { ok: false, error: verification.error ?? "Could not verify Telegram login." };
  }

  const telegramUserId = String(parsed.data.id);

  const [existing] = await db
    .select()
    .from(telegramAccounts)
    .where(eq(telegramAccounts.telegramUserId, telegramUserId))
    .limit(1);

  if (existing && existing.userId !== session.user.id) {
    return { ok: false, error: "This Telegram account is already linked to another user." };
  }

  if (existing) {
    await db
      .update(telegramAccounts)
      .set({ username: parsed.data.username })
      .where(eq(telegramAccounts.telegramUserId, telegramUserId));
  } else {
    await db.insert(telegramAccounts).values({
      userId: session.user.id,
      telegramUserId,
      username: parsed.data.username,
    });
  }

  return { ok: true, data: undefined };
}
