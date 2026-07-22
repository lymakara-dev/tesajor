import { and, eq, isNull } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { groupMembers, groups, paymentRequests } from "@/db/schema";
import { recordSettlement } from "@/lib/actions/settlements";
import { confirmPaymentRequest } from "@/lib/actions/payment-requests";
import { simplifyDebts } from "@/lib/balances/calculate";
import { getGroupNets } from "@/lib/queries/balances";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Money, type MoneyTone } from "@/components/money";
import { RecordPaymentForm } from "@/components/record-payment-form";
import { RequestPaymentsButton } from "@/components/request-payments-button";
import { Scale, HandCoins } from "lucide-react";

function netTone(netCents: number): MoneyTone {
  if (netCents > 0) return "owed";
  if (netCents < 0) return "owe";
  return "settled";
}

export default async function BalancesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const t = await getTranslations("balances");

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
  const myNetCents = currentMember
    ? (nets.find((n) => n.memberId === currentMember.id)?.netCents ?? 0)
    : 0;

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
        <h1 className="text-2xl font-semibold">{group.name}</h1>
        <p className="text-muted-foreground">{t("baseCurrency", { currency: group.baseCurrency })}</p>
      </div>

      {currentMember && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Scale className="size-4" strokeWidth={1.5} />
              {myNetCents === 0 ? t("youSettledUp") : myNetCents > 0 ? t("youAreOwed") : t("youOwe")}
            </span>
            <Money
              cents={Math.abs(myNetCents)}
              currency={group.baseCurrency}
              tone={netTone(myNetCents)}
              layout="stacked"
              size="xl"
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("netBalances")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {nets.map((n) => (
            <div
              key={n.memberId}
              className="flex items-center justify-between text-sm"
              data-testid={`net-${n.memberId}`}
            >
              <span>{memberName.get(n.memberId)}</span>
              <span className="flex items-center gap-1">
                {n.netCents === 0 ? (
                  <span className="text-muted-foreground">{t("settledUp")}</span>
                ) : (
                  <>
                    <span className="text-muted-foreground">
                      {n.netCents > 0 ? t("isOwed") : t("owes")}
                    </span>
                    <Money
                      cents={Math.abs(n.netCents)}
                      currency={group.baseCurrency}
                      tone={netTone(n.netCents)}
                      size="sm"
                    />
                  </>
                )}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("suggestedSettlements")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {suggestions.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("everyoneSettledUp")}</p>
          )}
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-3 text-sm">
              <span>
                {t("paysLine", { from: memberName.get(s.fromMemberId) ?? "", to: memberName.get(s.toMemberId) ?? "" })}{" "}
                <Money cents={s.amountCents} currency={group.baseCurrency} tone="neutral" />
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
                  {t("confirm")}
                </Button>
              </form>
            </div>
          ))}
        </CardContent>
      </Card>

      {pendingClaims.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-base">
              <HandCoins className="size-4" strokeWidth={1.5} />
              {t("paymentClaimsToConfirm")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingClaims.map((claim) => (
              <div key={claim.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {t("claimLine", { name: memberName.get(claim.debtorMember) ?? "" })}{" "}
                  <Money cents={claim.amountCents} currency={group.baseCurrency} tone="neutral" />{" "}
                  {t("viaTelegram")}
                </span>
                <form
                  action={async () => {
                    "use server";
                    await confirmPaymentRequest(claim.id);
                  }}
                >
                  <Button type="submit" size="sm" data-testid={`confirm-claim-${claim.id}`}>
                    {t("confirm")}
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
