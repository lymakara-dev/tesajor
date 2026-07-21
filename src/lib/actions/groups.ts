"use server";

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { groups, groupMembers, activityLog, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { createGroupSchema, joinGroupSchema } from "@/lib/validation/groups";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function createGroup(
  input: unknown,
): Promise<ActionResult<{ groupId: string; inviteCode: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid group details." };
  }

  const [user] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const inviteCode = nanoid(10);

  const [group] = await db
    .insert(groups)
    .values({
      name: parsed.data.name,
      baseCurrency: parsed.data.baseCurrency,
      inviteCode,
      createdBy: session.user.id,
    })
    .returning({ id: groups.id });

  await db.insert(groupMembers).values({
    groupId: group.id,
    userId: session.user.id,
    displayName: user?.name ?? "Member",
    role: "owner",
  });

  await db.insert(activityLog).values({
    groupId: group.id,
    actor: session.user.id,
    action: "group.created",
    payloadJson: { name: parsed.data.name },
  });

  revalidatePath("/groups");
  return { ok: true, data: { groupId: group.id, inviteCode } };
}

export async function joinGroupByInviteCode(
  input: unknown,
): Promise<ActionResult<{ groupId: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = joinGroupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid invite code." };
  }

  const [group] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.inviteCode, parsed.data.inviteCode))
    .limit(1);
  if (!group) {
    return { ok: false, error: "Invite code not found." };
  }

  const existingMembers = await db
    .select({ id: groupMembers.id, userId: groupMembers.userId })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, group.id));

  if (existingMembers.some((m) => m.userId === session.user.id)) {
    return { ok: true, data: { groupId: group.id } };
  }

  const [user] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  await db.insert(groupMembers).values({
    groupId: group.id,
    userId: session.user.id,
    displayName: user?.name ?? "Member",
    role: "member",
  });

  await db.insert(activityLog).values({
    groupId: group.id,
    actor: session.user.id,
    action: "group.member_joined",
    payloadJson: { userId: session.user.id },
  });

  return { ok: true, data: { groupId: group.id } };
}
