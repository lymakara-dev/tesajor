"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  groupMembers,
  groups,
  paymentMethods,
  paymentRequests,
  telegramAccounts,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireUserIsMember } from "@/lib/actions/group-membership";
import { recordSettlement } from "@/lib/actions/settlements";
import { incomingRequestsFor } from "@/lib/telegram/amounts";
import { simplifyDebts } from "@/lib/balances/calculate";
import { getGroupNets } from "@/lib/queries/balances";
import { formatCents } from "@/lib/money/cents";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendPaymentRequestPhoto, TelegramNotConfiguredError } from "@/lib/telegram/client";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface RequestPaymentsSummary {
  sent: string[];
  unlinked: string[];
}

export async function requestPaymentsViaTelegram(
  groupId: string,
): Promise<ActionResult<RequestPaymentsSummary>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const isMember = await requireUserIsMember(groupId, session.user.id);
  if (!isMember) {
    return { ok: false, error: "You are not a member of this group." };
  }

  if (!checkRateLimit(`payment-request:${groupId}`, 1, 60 * 60 * 1000)) {
    return { ok: false, error: "Only one request batch per group per hour." };
  }

  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) return { ok: false, error: "Group not found." };

  const members = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  const requesterMember = members.find((m) => m.userId === session.user.id);
  if (!requesterMember) return { ok: false, error: "You are not a member of this group." };

  const [defaultMethod] = await db
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.userId, session.user.id), eq(paymentMethods.isDefault, true)))
    .limit(1);
  if (!defaultMethod?.qrImageUrl) {
    return { ok: false, error: "Add a default payment method with a QR code first." };
  }

  const nets = await getGroupNets(groupId);
  const transactions = simplifyDebts(nets);
  const incoming = incomingRequestsFor(transactions, requesterMember.id);
  if (incoming.length === 0) {
    return { ok: false, error: "Nobody currently owes you money in this group." };
  }

  const appUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  // qrImageUrl is either a same-origin "/uploads/..." path (needs the app
  // origin prefixed) or, when Cloudinary is configured, an already-absolute
  // https://res.cloudinary.com/... URL (must be used as-is).
  const resolvePhotoUrl = (qrImageUrl: string) =>
    qrImageUrl.startsWith("/") ? `${appUrl}${qrImageUrl}` : qrImageUrl;
  const memberById = new Map(members.map((m) => [m.id, m]));

  const sent: string[] = [];
  const unlinked: string[] = [];

  for (const request of incoming) {
    const debtor = memberById.get(request.debtorMemberId);
    if (!debtor) continue;

    const telegramAccount = debtor.userId
      ? (
          await db
            .select()
            .from(telegramAccounts)
            .where(eq(telegramAccounts.userId, debtor.userId))
            .limit(1)
        )[0]
      : undefined;

    if (!telegramAccount?.chatId) {
      unlinked.push(debtor.displayName);
      await db.insert(paymentRequests).values({
        groupId,
        requesterMember: requesterMember.id,
        debtorMember: debtor.id,
        amountCents: request.amountCents,
        paymentMethodId: defaultMethod.id,
        status: "failed",
      });
      continue;
    }

    const caption =
      `🧾 ${group.name} — you owe ${requesterMember.displayName} ` +
      `${formatCents(request.amountCents, group.baseCurrency)}.\n` +
      `Scan the QR to pay, then tap ✅.`;

    try {
      const [row] = await db
        .insert(paymentRequests)
        .values({
          groupId,
          requesterMember: requesterMember.id,
          debtorMember: debtor.id,
          amountCents: request.amountCents,
          paymentMethodId: defaultMethod.id,
          status: "sent",
        })
        .returning({ id: paymentRequests.id });

      const result = await sendPaymentRequestPhoto({
        chatId: telegramAccount.chatId,
        photoUrl: resolvePhotoUrl(defaultMethod.qrImageUrl),
        caption,
        paymentRequestId: row.id,
      });

      await db
        .update(paymentRequests)
        .set({ telegramMessageId: String(result.message_id) })
        .where(eq(paymentRequests.id, row.id));

      sent.push(debtor.displayName);
    } catch (error) {
      if (error instanceof TelegramNotConfiguredError) {
        return { ok: false, error: "Telegram isn't configured on this server yet." };
      }
      unlinked.push(debtor.displayName);
    }
  }

  revalidatePath(`/groups/${groupId}/balances`);
  return { ok: true, data: { sent, unlinked } };
}

export async function confirmPaymentRequest(
  paymentRequestId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const [request] = await db
    .select()
    .from(paymentRequests)
    .where(eq(paymentRequests.id, paymentRequestId))
    .limit(1);
  if (!request) return { ok: false, error: "Request not found." };
  if (request.confirmedAt) return { ok: false, error: "Already confirmed." };
  if (request.status !== "paid") {
    return { ok: false, error: "The debtor hasn't marked this as paid yet." };
  }

  const [requesterMember] = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.id, request.requesterMember))
    .limit(1);
  if (!requesterMember || requesterMember.userId !== session.user.id) {
    return { ok: false, error: "Only the requester can confirm this payment." };
  }

  const [debtorMember] = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.id, request.debtorMember))
    .limit(1);
  if (!debtorMember) return { ok: false, error: "Debtor member not found." };

  const settlementResult = await recordSettlement({
    groupId: request.groupId,
    fromMemberId: debtorMember.id,
    toMemberId: requesterMember.id,
    amountCents: request.amountCents,
    method: "Telegram payment request",
  });
  if (!settlementResult.ok) return settlementResult;

  await db
    .update(paymentRequests)
    .set({ confirmedAt: new Date(), settlementId: settlementResult.data.settlementId })
    .where(and(eq(paymentRequests.id, paymentRequestId), isNull(paymentRequests.confirmedAt)));

  revalidatePath(`/groups/${request.groupId}/balances`);
  return { ok: true, data: undefined };
}
