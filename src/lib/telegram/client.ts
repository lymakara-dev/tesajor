const TELEGRAM_API_BASE = "https://api.telegram.org";

export class TelegramNotConfiguredError extends Error {
  constructor() {
    super("TELEGRAM_BOT_TOKEN is not set.");
    this.name = "TelegramNotConfiguredError";
  }
}

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new TelegramNotConfiguredError();
  return token;
}

async function callTelegramApi<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok || !json.ok) {
    throw new Error(`Telegram API ${method} failed: ${json.description ?? response.statusText}`);
  }
  return json.result as T;
}

export interface SendPhotoResult {
  message_id: number;
}

/** Sends a payment-request photo message with an inline "I've paid" button. */
export async function sendPaymentRequestPhoto(params: {
  chatId: string;
  photoUrl: string;
  caption: string;
  paymentRequestId: string;
}): Promise<SendPhotoResult> {
  return callTelegramApi<SendPhotoResult>("sendPhoto", {
    chat_id: params.chatId,
    photo: params.photoUrl,
    caption: params.caption,
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ I've paid", callback_data: `paid:${params.paymentRequestId}` }],
      ],
    },
  });
}

export async function sendTextMessage(chatId: string, text: string): Promise<void> {
  await callTelegramApi("sendMessage", { chat_id: chatId, text });
}

export async function answerCallbackQuery(callbackQueryId: string, text: string): Promise<void> {
  await callTelegramApi("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}
