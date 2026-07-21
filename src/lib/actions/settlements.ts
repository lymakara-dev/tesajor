"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activityLog, settlements } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireGroupMemberIds, requireUserIsMember } from "@/lib/actions/group-membership";
import { recordSettlementSchema } from "@/lib/validation/settlements";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function recordSettlement(
  input: unknown,
): Promise<ActionResult<{ settlementId: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = recordSettlementSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settlement." };
  }
  const settlement = parsed.data;

  const isMember = await requireUserIsMember(settlement.groupId, session.user.id);
  if (!isMember) {
    return { ok: false, error: "You are not a member of this group." };
  }

  const validMemberIds = await requireGroupMemberIds(settlement.groupId);
  if (
    !validMemberIds.has(settlement.fromMemberId) ||
    !validMemberIds.has(settlement.toMemberId)
  ) {
    return { ok: false, error: "One or more members don't belong to this group." };
  }

  const settlementId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(settlements)
      .values({
        groupId: settlement.groupId,
        fromMember: settlement.fromMemberId,
        toMember: settlement.toMemberId,
        amountCents: settlement.amountCents,
        method: settlement.method,
        note: settlement.note,
      })
      .returning({ id: settlements.id });

    await tx.insert(activityLog).values({
      groupId: settlement.groupId,
      actor: session.user.id,
      action: "settlement.recorded",
      payloadJson: {
        settlementId: row.id,
        fromMemberId: settlement.fromMemberId,
        toMemberId: settlement.toMemberId,
        amountCents: settlement.amountCents,
      },
    });

    return row.id;
  });

  revalidatePath(`/groups/${settlement.groupId}`);
  revalidatePath(`/groups/${settlement.groupId}/balances`);
  return { ok: true, data: { settlementId } };
}
