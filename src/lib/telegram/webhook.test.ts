import { describe, expect, it } from "vitest";
import { parseTelegramUpdate } from "./webhook";

describe("parseTelegramUpdate", () => {
  it("parses a /start deep-link message into a link intent", () => {
    const intent = parseTelegramUpdate({
      message: {
        text: "/start abc123token",
        chat: { id: 555 },
        from: { id: 999, username: "ada" },
      },
    });
    expect(intent).toEqual({
      type: "link",
      token: "abc123token",
      telegramUserId: "999",
      chatId: "555",
      username: "ada",
    });
  });

  it("parses a paid: callback query into a markPaid intent", () => {
    const intent = parseTelegramUpdate({
      callback_query: {
        id: "cbq-1",
        data: "paid:e4b1c2d3-0000-0000-0000-000000000000",
        from: { id: 42 },
      },
    });
    expect(intent).toEqual({
      type: "markPaid",
      paymentRequestId: "e4b1c2d3-0000-0000-0000-000000000000",
      telegramUserId: "42",
      callbackQueryId: "cbq-1",
    });
  });

  it("ignores an unrelated message", () => {
    const intent = parseTelegramUpdate({
      message: { text: "hello", chat: { id: 1 }, from: { id: 2 } },
    });
    expect(intent).toEqual({ type: "ignore" });
  });

  it("ignores a /start with no token", () => {
    const intent = parseTelegramUpdate({
      message: { text: "/start ", chat: { id: 1 }, from: { id: 2 } },
    });
    expect(intent).toEqual({ type: "ignore" });
  });

  it("ignores an unrelated callback query", () => {
    const intent = parseTelegramUpdate({
      callback_query: { id: "cbq-2", data: "something-else", from: { id: 2 } },
    });
    expect(intent).toEqual({ type: "ignore" });
  });

  it("ignores an empty update", () => {
    expect(parseTelegramUpdate({})).toEqual({ type: "ignore" });
  });
});
