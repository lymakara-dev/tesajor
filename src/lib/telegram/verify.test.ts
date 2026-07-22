import { createHash, createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { verifyTelegramAuth, type TelegramAuthData } from "./verify";

const BOT_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";

function signPayload(
  fields: Omit<TelegramAuthData, "hash">,
  botToken = BOT_TOKEN,
): TelegramAuthData {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${(fields as Record<string, unknown>)[key]}`)
    .join("\n");
  const secretKey = createHash("sha256").update(botToken).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return { ...fields, hash };
}

describe("verifyTelegramAuth", () => {
  it("accepts a correctly signed, fresh payload", () => {
    const now = 1_700_000_000;
    const payload = signPayload({
      id: 12345,
      first_name: "Ada",
      username: "ada_lovelace",
      auth_date: now - 10,
    });

    const result = verifyTelegramAuth(payload, BOT_TOKEN, { now });
    expect(result.ok).toBe(true);
  });

  it("rejects a payload signed with the wrong bot token", () => {
    const now = 1_700_000_000;
    const payload = signPayload(
      { id: 12345, first_name: "Ada", auth_date: now - 10 },
      "wrong-token",
    );

    const result = verifyTelegramAuth(payload, BOT_TOKEN, { now });
    expect(result.ok).toBe(false);
  });

  it("rejects a tampered field (id changed after signing)", () => {
    const now = 1_700_000_000;
    const payload = signPayload({ id: 12345, first_name: "Ada", auth_date: now - 10 });
    const tampered = { ...payload, id: 99999 };

    const result = verifyTelegramAuth(tampered, BOT_TOKEN, { now });
    expect(result.ok).toBe(false);
  });

  it("rejects a stale auth_date beyond the max age", () => {
    const now = 1_700_000_000;
    const twoDaysAgo = now - 2 * 24 * 60 * 60;
    const payload = signPayload({ id: 12345, first_name: "Ada", auth_date: twoDaysAgo });

    const result = verifyTelegramAuth(payload, BOT_TOKEN, { now });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/expired/i);
  });

  it("accepts a custom max age within range", () => {
    const now = 1_700_000_000;
    const fiveMinutesAgo = now - 5 * 60;
    const payload = signPayload({ id: 12345, first_name: "Ada", auth_date: fiveMinutesAgo });

    const result = verifyTelegramAuth(payload, BOT_TOKEN, { now, maxAgeSeconds: 60 });
    expect(result.ok).toBe(false);
  });

  it("rejects an auth_date far in the future", () => {
    const now = 1_700_000_000;
    const payload = signPayload({ id: 12345, first_name: "Ada", auth_date: now + 3600 });

    const result = verifyTelegramAuth(payload, BOT_TOKEN, { now });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/future/i);
  });

  it("rejects a missing or malformed hash", () => {
    const result = verifyTelegramAuth(
      { id: 1, auth_date: 1_700_000_000, hash: "not-hex" },
      BOT_TOKEN,
    );
    expect(result.ok).toBe(false);
  });
});
