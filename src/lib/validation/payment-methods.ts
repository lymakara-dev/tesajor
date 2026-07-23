import { z } from "zod";
import { uploadPathSchema } from "@/lib/validation/upload-path";

export const addPaymentMethodSchema = z
  .object({
    label: z.string().trim().min(1).max(60),
    qrImageUrl: uploadPathSchema.optional(),
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
