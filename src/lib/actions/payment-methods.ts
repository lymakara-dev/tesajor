"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { db } from "@/db";
import { paymentMethods } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isCloudinaryConfigured, uploadToCloudinary } from "@/lib/cloudinary";
import {
  addPaymentMethodSchema,
  deletePaymentMethodSchema,
} from "@/lib/validation/payment-methods";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Mirrors the fallback in src/app/api/uploads/route.ts: on serverless hosts
// (e.g. Vercel) the deployed filesystem is read-only outside /tmp, so a
// bare writeFile into public/uploads silently doesn't persist. Cloudinary
// must be used whenever it's configured; local disk is a dev-only fallback.
async function generateQrImage(paymentLink: string): Promise<string> {
  const buffer = await QRCode.toBuffer(paymentLink, { type: "png", width: 400 });

  if (isCloudinaryConfigured) {
    return uploadToCloudinary(buffer);
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const filename = `${randomUUID()}.png`;
  await writeFile(path.join(uploadsDir, filename), buffer);
  return `/uploads/${filename}`;
}

export async function addPaymentMethod(
  input: unknown,
): Promise<ActionResult<{ paymentMethodId: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = addPaymentMethodSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payment method." };
  }
  const data = parsed.data;

  const qrImageUrl =
    data.qrImageUrl ?? (data.paymentLink ? await generateQrImage(data.paymentLink) : undefined);

  const paymentMethodId = await db.transaction(async (tx) => {
    if (data.isDefault) {
      await tx
        .update(paymentMethods)
        .set({ isDefault: false })
        .where(eq(paymentMethods.userId, session.user.id));
    }

    const [row] = await tx
      .insert(paymentMethods)
      .values({
        userId: session.user.id,
        label: data.label,
        qrImageUrl,
        paymentLink: data.paymentLink,
        isDefault: data.isDefault,
      })
      .returning({ id: paymentMethods.id });

    return row.id;
  });

  revalidatePath("/account");
  return { ok: true, data: { paymentMethodId } };
}

export async function deletePaymentMethod(input: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = deletePaymentMethodSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid request." };
  }

  await db
    .delete(paymentMethods)
    .where(
      and(
        eq(paymentMethods.id, parsed.data.paymentMethodId),
        eq(paymentMethods.userId, session.user.id),
      ),
    );

  revalidatePath("/account");
  return { ok: true, data: undefined };
}
