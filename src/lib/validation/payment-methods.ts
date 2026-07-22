import { z } from "zod";

// Must be a same-origin path produced by our own upload endpoint
// (/api/uploads or the server-side QR generator), e.g. "/uploads/<uuid>.png".
// This value later gets concatenated onto a server-side base URL and handed
// to the Telegram Bot API as a photo URL (see requestPaymentsViaTelegram) —
// accepting an arbitrary string here would let a user redirect that
// server-to-server fetch anywhere (including via the classic
// "http://ourapp.com@attacker.com" userinfo trick), so this must never
// accept a full URL or anything containing "://" or "@".
const uploadPathPattern = /^\/uploads\/[a-zA-Z0-9._-]+$/;

export const addPaymentMethodSchema = z
  .object({
    label: z.string().trim().min(1).max(60),
    qrImageUrl: z.string().trim().regex(uploadPathPattern).max(2048).optional(),
    paymentLink: z.url().optional(),
    isDefault: z.boolean().default(false),
  })
  .refine((data) => Boolean(data.qrImageUrl) || Boolean(data.paymentLink), {
    message: "Upload a QR image or provide a payment link.",
    path: ["qrImageUrl"],
  });

export type AddPaymentMethodInput = z.infer<typeof addPaymentMethodSchema>;

export const deletePaymentMethodSchema = z.object({
  paymentMethodId: z.uuid(),
});
