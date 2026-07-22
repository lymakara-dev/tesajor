import { createHash, createHmac, timingSafeEqual } from "crypto";

export interface TelegramAuthData {
  id: string | number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string | number;
  hash: string;
}

export interface VerifyResult {
  ok: boolean;
  error?: string;
}

const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60;
const HEX_64 = /^[0-9a-f]{64}$/i;

/**
 * Verifies a Telegram Login Widget payload per Telegram's documented
 * algorithm: https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramAuth(
  data: TelegramAuthData,
  botToken: string,
  options: { maxAgeSeconds?: number; now?: number } = {},
): VerifyResult {
  const { hash, ...rest } = data;
  if (!hash || !HEX_64.test(hash)) {
    return { ok: false, error: "Missing or malformed hash." };
  }

  const dataCheckString = (Object.keys(rest) as (keyof typeof rest)[])
    .filter((key) => rest[key] !== undefined && rest[key] !== null)
    .sort()
    .map((key) => `${key}=${rest[key]}`)
    .join("\n");

  const secretKey = createHash("sha256").update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const computedBuffer = Buffer.from(computedHash, "hex");
  const providedBuffer = Buffer.from(hash, "hex");
  if (
    computedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(computedBuffer, providedBuffer)
  ) {
    return { ok: false, error: "Invalid signature." };
  }

  const authDate = Number(data.auth_date);
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const maxAge = options.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;
  if (!Number.isFinite(authDate) || now - authDate > maxAge) {
    return { ok: false, error: "Authorization has expired." };
  }
  if (authDate > now + 60) {
    return { ok: false, error: "Authorization timestamp is in the future." };
  }

  return { ok: true };
}
