import { and, eq, isNull } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { groupMembers, groups, paymentRequests } from "@/db/schema";
import { recordSettlement } from "@/lib/actions/settlements";
import { confirmPaymentRequest } from "@/lib/actions/payment-requests";
import { simplifyDebts } from "@/lib/balances/calculate";
import { getGroupNets } from "@/lib/queries/balances";
import { formatCents } from "@/lib/money/cents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RecordPaymentForm } from "@/components/record-payment-form";
import { RequestPaymentsButton } from "@/components/request-payments-button";

export default async function BalancesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
  if (!group) notFound();

  const members = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.groupId, id));
  const isMember = members.some((m) => m.userId === session.user.id);
  if (!isMember) redirect("/groups");

  const memberName = new Map(members.map((m) => [m.id, m.displayName]));

  const nets = await getGroupNets(id);
  const suggestions = simplifyDebts(nets);

  const currentMember = members.find((m) => m.userId === session.user.id);

  const pendingClaims = currentMember
    ? await db
        .select()
        .from(paymentRequests)
        .where(
          and(
            eq(paymentRequests.requesterMember, currentMember.id),
            eq(paymentRequests.status, "paid"),
            isNull(paymentRequests.confirmedAt),
          ),
        )
    : [];

  return (
    <div className="mx-auto max-w-[480px] px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{group.name} — Balances</h1>
        <p className="text-muted-foreground">Base currency: {group.baseCurrency}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Net balances</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {nets.map((n) => (
            <div
              key={n.memberId}
              className="flex items-center justify-between text-sm"
              data-testid={`net-${n.memberId}`}
            >
              <span>{memberName.get(n.memberId)}</span>
              <span
                className={
                  n.netCents > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : n.netCents < 0
                      ? "text-destructive"
                      : "text-muted-foreground"
                }
              >
                {n.netCents === 0
                  ? "settled up"
                  : n.netCents > 0
                    ? `is owed ${formatCents(n.netCents, group.baseCurrency)}`
                    : `owes ${formatCents(-n.netCents, group.baseCurrency)}`}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Suggested settlements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {suggestions.length === 0 && (
            <p className="text-sm text-muted-foreground">Everyone is settled up.</p>
          )}
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-3 text-sm">
              <span>
                {memberName.get(s.fromMemberId)} pays {memberName.get(s.toMemberId)}{" "}
                <span className="font-medium">{formatCents(s.amountCents, group.baseCurrency)}</span>
              </span>
              <form
                action={async () => {
                  "use server";
                  await recordSettlement({
                    groupId: id,
                    fromMemberId: s.fromMemberId,
                    toMemberId: s.toMemberId,
                    amountCents: s.amountCents,
                    method: "simplified debts",
                  });
                }}
              >
                <Button
                  type="submit"
                  size="sm"
                  data-testid={`confirm-suggestion-${s.fromMemberId}-${s.toMemberId}`}
                >
                  Confirm
                </Button>
              </form>
            </div>
          ))}
        </CardContent>
      </Card>

      {pendingClaims.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment claims to confirm</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingClaims.map((claim) => (
              <div key={claim.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {memberName.get(claim.debtorMember)} says they paid you{" "}
                  <span className="font-medium">
                    {formatCents(claim.amountCents, group.baseCurrency)}
                  </span>{" "}
                  via Telegram
                </span>
                <form
                  action={async () => {
                    "use server";
                    await confirmPaymentRequest(claim.id);
                  }}
                >
                  <Button type="submit" size="sm" data-testid={`confirm-claim-${claim.id}`}>
                    Confirm
                  </Button>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {currentMember && <RequestPaymentsButton groupId={id} />}

      <RecordPaymentForm
        groupId={id}
        members={members.map((m) => ({ id: m.id, displayName: m.displayName }))}
      />
    </div>
  );
}
