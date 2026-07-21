"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, groupMembers, sessions, users } from "@/db/schema";
import { auth } from "@/lib/auth";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * GDPR-style deletion: anonymizes personal identifiers everywhere (account
 * row, and display name in any group they belonged to) but keeps expense
 * and settlement rows intact so other members' balances stay accurate.
 */
export async function deleteAccount(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }
  const userId = session.user.id;

  await db.transaction(async (tx) => {
    await tx
      .update(groupMembers)
      .set({ displayName: "Deleted user" })
      .where(eq(groupMembers.userId, userId));

    await tx.delete(accounts).where(eq(accounts.userId, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));

    await tx
      .update(users)
      .set({
        name: "Deleted user",
        email: `deleted-${userId}@deleted.tesajor.local`,
        passwordHash: null,
        image: null,
      })
      .where(eq(users.id, userId));
  });

  return { ok: true, data: undefined };
}
