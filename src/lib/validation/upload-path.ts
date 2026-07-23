import { z } from "zod";

// Must be either a same-origin path produced by our own /api/uploads
// endpoint (e.g. "/uploads/<uuid>.png") or, when Cloudinary is configured,
// a secure_url from our own Cloudinary cloud — never an arbitrary URL.
// Values here get rendered as raw href/src attributes and (for payment QR
// images) concatenated onto a server-side base URL and handed to the
// Telegram Bot API as a photo URL, so accepting anything else would allow
// a "javascript:" XSS payload via href, or the classic
// "http://ourapp.com@attacker.com" userinfo SSRF trick via the Telegram
// fetch. Restricting the Cloudinary case to our own cloud_name (rather
// than any res.cloudinary.com URL) keeps that same "only ever our own
// uploaded files" guarantee.
const localUploadPattern = /^\/uploads\/[a-zA-Z0-9._-]+$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * `cloudName` defaults to the configured CLOUDINARY_CLOUD_NAME so
 * production call sites need no argument; tests pass an explicit value to
 * exercise the Cloudinary branch deterministically regardless of the
 * process env.
 */
export function isOwnUploadUrl(
  value: string,
  cloudName: string | undefined = process.env.CLOUDINARY_CLOUD_NAME,
): boolean {
  if (localUploadPattern.test(value)) return true;
  if (!cloudName) return false;
  const cloudinaryPattern = new RegExp(`^https://res\\.cloudinary\\.com/${escapeRegExp(cloudName)}/.+$`);
  return cloudinaryPattern.test(value);
}

export const uploadPathSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => isOwnUploadUrl(value), { message: "Must be an uploaded file." });
