export type TelegramWebhookIntent =
  | { type: "link"; token: string; telegramUserId: string; chatId: string; username?: string }
  | { type: "markPaid"; paymentRequestId: string; telegramUserId: string; callbackQueryId: string }
  | { type: "ignore" };

export interface TelegramUpdate {
  message?: {
    text?: string;
    chat: { id: number | string };
    from: { id: number | string; username?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    from: { id: number | string };
  };
}

/**
 * Pure parser: turns a raw Telegram Bot API update into an intent our
 * webhook route should act on. Keeping this side-effect-free makes the
 * webhook's routing logic testable without a live bot or database.
 */
export function parseTelegramUpdate(update: TelegramUpdate): TelegramWebhookIntent {
  const text = update.message?.text?.trim();
  if (text?.startsWith("/start ") && update.message) {
    const token = text.slice("/start ".length).trim();
    if (token) {
      return {
        type: "link",
        token,
        telegramUserId: String(update.message.from.id),
        chatId: String(update.message.chat.id),
        username: update.message.from.username,
      };
    }
  }

  const callbackData = update.callback_query?.data;
  if (callbackData?.startsWith("paid:") && update.callback_query) {
    const paymentRequestId = callbackData.slice("paid:".length);
    if (paymentRequestId) {
      return {
        type: "markPaid",
        paymentRequestId,
        telegramUserId: String(update.callback_query.from.id),
        callbackQueryId: update.callback_query.id,
      };
    }
  }

  return { type: "ignore" };
}
