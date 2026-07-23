import { and, eq, inArray, isNull } from "drizzle-orm";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  expenseShares,
  expenses,
  groupMembers,
  groups,
  paymentMethods,
  paymentRequests,
} from "@/db/schema";
import { recordSettlement } from "@/lib/actions/settlements";
import { confirmPaymentRequest } from "@/lib/actions/payment-requests";
import { simplifyDebts } from "@/lib/balances/calculate";
import { getGroupNets } from "@/lib/queries/balances";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Money, type MoneyTone } from "@/components/money";
import { MemberAvatar } from "@/components/member-avatar";
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

  // How many expenses each member shares in — presentation-only context on
  // the balance rows, not used in any balance/settlement math.
  const groupExpenseIds = (
    await db
      .select({ id: expenses.id })
      .from(expenses)
      .where(and(eq(expenses.groupId, id), isNull(expenses.deletedAt)))
  ).map((e) => e.id);
  const shareRows = groupExpenseIds.length
    ? await db
        .select({ memberId: expenseShares.memberId })
        .from(expenseShares)
        .where(inArray(expenseShares.expenseId, groupExpenseIds))
    : [];
  const expenseCountByMember = new Map<string, number>();
  for (const row of shareRows) {
    expenseCountByMember.set(row.memberId, (expenseCountByMember.get(row.memberId) ?? 0) + 1);
  }

  const myPaymentMethods = session.user.id
    ? await db.select().from(paymentMethods).where(eq(paymentMethods.userId, session.user.id))
    : [];
  const myDefaultMethod = myPaymentMethods.find((m) => m.isDefault) ?? myPaymentMethods[0] ?? null;

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

      {currentMember && myDefaultMethod && (
        <div className="flex items-center gap-3 rounded-xl bg-krama p-4 text-rice">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-rice p-1">
            {myDefaultMethod.qrImageUrl ? (
              <Image
                src={myDefaultMethod.qrImageUrl}
                alt={myDefaultMethod.label}
                width={48}
                height={48}
                className="size-full rounded-sm object-cover"
              />
            ) : (
              <span className="text-[10px] font-medium text-krama">QR</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="amount truncate text-sm font-bold">
              {myDefaultMethod.label || t("khqrDefaultLabel")}
            </p>
            <p className="truncate text-xs text-rice/80">{currentMember.displayName}</p>
          </div>
          <RequestPaymentsButton groupId={id} variant="khqr" />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("netBalances")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {nets.map((n) => (
            <div
              key={n.memberId}
              className="flex items-center gap-3 text-sm"
              data-testid={`net-${n.memberId}`}
            >
              <MemberAvatar id={n.memberId} name={memberName.get(n.memberId) ?? "?"} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{memberName.get(n.memberId)}</span>
                {(expenseCountByMember.get(n.memberId) ?? 0) > 0 && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {t("expenseCount", { count: expenseCountByMember.get(n.memberId) ?? 0 })}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-1">
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
              <span className="flex min-w-0 items-center gap-2">
                <span className="-space-x-2 flex shrink-0">
                  <MemberAvatar
                    id={s.fromMemberId}
                    name={memberName.get(s.fromMemberId) ?? "?"}
                    size="sm"
                    className="ring-2 ring-background"
                  />
                  <MemberAvatar
                    id={s.toMemberId}
                    name={memberName.get(s.toMemberId) ?? "?"}
                    size="sm"
                    className="ring-2 ring-background"
                  />
                </span>
                <span className="min-w-0">
                  {t("paysLine", { from: memberName.get(s.fromMemberId) ?? "", to: memberName.get(s.toMemberId) ?? "" })}{" "}
                  <Money cents={s.amountCents} currency={group.baseCurrency} tone="neutral" />
                </span>
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
            <CardTitle className="flex items-center gap-2 text-base">
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

      {currentMember && !myDefaultMethod && <RequestPaymentsButton groupId={id} />}

      <RecordPaymentForm
        groupId={id}
        members={members.map((m) => ({ id: m.id, displayName: m.displayName }))}
      />
    </div>
  );
}
