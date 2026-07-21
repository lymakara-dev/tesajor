"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import type { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation/auth";

export type RegisterResult =
  | { ok: true }
  | { ok: false; error: string };

export async function registerUser(
  input: z.infer<typeof registerSchema>,
): Promise<RegisterResult> {
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`register:${ip}`, 5, 15 * 60 * 1000)) {
    return { ok: false, error: "Too many registration attempts. Try again later." };
  }

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid registration details." };
  }
  const { name, email, password } = parsed.data;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    return { ok: false, error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.insert(users).values({ name, email, passwordHash });

  return { ok: true };
}
