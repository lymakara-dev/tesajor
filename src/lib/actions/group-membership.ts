import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers } from "@/db/schema";

export async function requireGroupMemberIds(groupId: string): Promise<Set<string>> {
  const members = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  return new Set(members.map((m) => m.id));
}

export async function requireUserIsMember(
  groupId: string,
  userId: string,
): Promise<boolean> {
  const [membership] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  return Boolean(membership);
}
