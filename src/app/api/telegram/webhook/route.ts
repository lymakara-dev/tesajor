import { and, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { groupMembers, paymentRequests, telegramAccounts, telegramLinkTokens } from "@/db/schema";
import { answerCallbackQuery, sendTextMessage } from "@/lib/telegram/client";
import { parseTelegramUpdate, type TelegramUpdate } from "@/lib/telegram/webhook";

export async function POST(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const providedSecret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!expectedSecret || providedSecret !== expectedSecret) {
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

      await db.delete(telegramLinkTokens).where(eq(telegramLinkTokens.token, intent.token));

      await sendTextMessage(
        intent.chatId,
        "✅ Telegram connected! You'll get payment requests here.",
      ).catch(() => {});
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
