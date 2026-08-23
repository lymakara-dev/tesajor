const URL_SAFE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

/**
 * Generates a cryptographically secure, URL-safe random identifier of specified length.
 * Uses native Web Crypto API (`crypto.getRandomValues`) with uniform distribution.
 */
export function generateInviteCode(length: number = 10): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let id = "";
  for (let i = 0; i < length; i++) {
    id += URL_SAFE_ALPHABET[bytes[i] & 63];
  }
  return id;
}
