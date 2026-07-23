import { z } from "zod";

// Must be a same-origin path produced by our own /api/uploads endpoint,
// e.g. "/uploads/<uuid>.png" — never a full URL. Values here get rendered
// as raw href/src attributes and (for payment QR images) concatenated onto
// a server-side base URL and handed to the Telegram Bot API as a photo
// URL, so accepting anything else would allow a "javascript:" XSS payload
// via href, or the classic "http://ourapp.com@attacker.com" userinfo SSRF
// trick via the Telegram fetch.
const uploadPathPattern = /^\/uploads\/[a-zA-Z0-9._-]+$/;

export const uploadPathSchema = z.string().trim().regex(uploadPathPattern).max(2048);
