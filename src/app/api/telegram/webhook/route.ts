import { timingSafeEqual } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { groupMembers, paymentRequests, telegramAccounts, telegramLinkTokens } from "@/db/schema";
import { answerCallbackQuery, sendTextMessage } from "@/lib/telegram/client";
import { parseTelegramUpdate, type TelegramUpdate } from "@/lib/telegram/webhook";

function secretMatches(expected: string, provided: string | null): boolean {
  if (!provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

export async function POST(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const providedSecret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!expectedSecret || !secretMatches(expectedSecret, providedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = (await request.json()) as TelegramUpdate;
  const intent = parseTelegramUpdate(update);

  if (intent.type === "link") {
    const [tokenRow] = await db
      .select()
      .from(telegramLinkTokens)
      .where(
        and(
          eq(telegramLinkTokens.token, intent.token),
          gt(telegramLinkTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (tokenRow) {
      const [existing] = await db
        .select()
        .from(telegramAccounts)
        .where(eq(telegramAccounts.telegramUserId, intent.telegramUserId))
        .limit(1);

      if (existing && existing.userId !== tokenRow.userId) {
        // This Telegram account is already linked to a different app user.
        // Reassigning it here would silently steal that link (e.g. someone
        // tricked into tapping a stranger's deep-link token) — the rightful
        // owner would stop receiving their own payment-request messages,
        // and future messages meant for the token generator would land in
        // this other person's chat instead. Reject; the existing owner
        // must disconnect first.
        await sendTextMessage(
          intent.chatId,
          "This Telegram account is already connected to a different account. Disconnect it there first if you want to relink it.",
        ).catch(() => {});
      } else {
        if (existing) {
          await db
            .update(telegramAccounts)
            .set({ userId: tokenRow.userId, chatId: intent.chatId, username: intent.username })
            .where(eq(telegramAccounts.telegramUserId, intent.telegramUserId));
        } else {
          await db.insert(telegramAccounts).values({
            userId: tokenRow.userId,
            telegramUserId: intent.telegramUserId,
            chatId: intent.chatId,
            username: intent.username,
          });
        }

        await sendTextMessage(
          intent.chatId,
          "✅ Telegram connected! You'll get payment requests here.",
        ).catch(() => {});
      }

      await db.delete(telegramLinkTokens).where(eq(telegramLinkTokens.token, intent.token));
    }
  }

  if (intent.type === "markPaid") {
    const [paymentRequest] = await db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.id, intent.paymentRequestId))
      .limit(1);

    if (!paymentRequest) {
      await answerCallbackQuery(intent.callbackQueryId, "Request not found.").catch(() => {});
    } else {
      const [debtorMember] = await db
        .select()
        .from(groupMembers)
        .where(eq(groupMembers.id, paymentRequest.debtorMember))
        .limit(1);

      const [debtorTelegram] = debtorMember?.userId
        ? await db
            .select()
            .from(telegramAccounts)
            .where(eq(telegramAccounts.userId, debtorMember.userId))
            .limit(1)
        : [];

      if (debtorTelegram?.telegramUserId !== intent.telegramUserId) {
        await answerCallbackQuery(intent.callbackQueryId, "This isn't your request.").catch(
          () => {},
        );
      } else if (paymentRequest.confirmedAt) {
        await answerCallbackQuery(intent.callbackQueryId, "Already confirmed.").catch(() => {});
      } else {
        await db
          .update(paymentRequests)
          .set({ status: "paid", paidAt: new Date() })
          .where(eq(paymentRequests.id, paymentRequest.id));

        await answerCallbackQuery(
          intent.callbackQueryId,
          "Marked as paid — waiting for the other person to confirm.",
        ).catch(() => {});
      }
    }
  }

  return NextResponse.json({ ok: true });
}
