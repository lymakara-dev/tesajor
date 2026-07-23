import { eq } from "drizzle-orm";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { groupMembers, groups, paymentMethods, users } from "@/db/schema";
import { getGroupNets } from "@/lib/queries/balances";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Money, type MoneyTone } from "@/components/money";
import { MemberAvatar } from "@/components/member-avatar";
import { MarketingLanding } from "@/components/marketing-landing";
import { Plus, Scale, Users } from "lucide-react";

function netTone(netCents: number): MoneyTone {
  if (netCents > 0) return "owed";
  if (netCents < 0) return "owe";
  return "settled";
}

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) return <MarketingLanding />;

  const t = await getTranslations("home");

  const [me] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  const defaultCurrency = me?.defaultCurrency ?? "USD";

  const memberships = await db
    .select({
      groupId: groups.id,
      groupName: groups.name,
      baseCurrency: groups.baseCurrency,
      memberId: groupMembers.id,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(eq(groupMembers.userId, session.user.id));

  const groupRows = await Promise.all(
    memberships.map(async (m) => {
      const nets = await getGroupNets(m.groupId);
      const netCents = nets.find((n) => n.memberId === m.memberId)?.netCents ?? 0;
      return { ...m, netCents };
    }),
  );

  const sameCurrencyRows = groupRows.filter((g) => g.baseCurrency === defaultCurrency);
  const otherCurrencyRows = groupRows.filter((g) => g.baseCurrency !== defaultCurrency);
  const totalNetCents = sameCurrencyRows.reduce((sum, g) => sum + g.netCents, 0);

  const myPaymentMethods = await db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.userId, session.user.id));
  const hasPaymentMethod = myPaymentMethods.length > 0;

  return (
    <div className="mx-auto max-w-[480px] space-y-8 px-4 py-10 sm:py-14">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">
          {t("greeting", { name: session.user.name ?? "" })}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-6 text-center sm:py-8">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Scale className="size-4" strokeWidth={1.5} />
            {totalNetCents === 0
              ? t("youSettledUp")
              : totalNetCents > 0
                ? t("youAreOwed")
                : t("youOwe")}
          </span>
          <Money
            cents={Math.abs(totalNetCents)}
            currency={defaultCurrency}
            tone={netTone(totalNetCents)}
            layout="stacked"
            size="xl"
          />
          {otherCurrencyRows.length > 0 && (
            <p className="text-xs text-muted-foreground">{t("otherCurrenciesNote")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-mekong" strokeWidth={1.5} />
            {t("yourGroups")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {groupRows.length === 0 && (
            <div className="space-y-3 py-2 text-center">
              <p className="text-sm text-muted-foreground">{t("noGroupsYet")}</p>
              <Link href="/groups" className="block sm:inline-block">
                <Button className="w-full sm:w-auto">
                  <Plus className="size-4" strokeWidth={1.5} />
                  {t("createGroup")}
                </Button>
              </Link>
            </div>
          )}
          {groupRows.map((g) => (
            <Link
              key={g.groupId}
              href={`/groups/${g.groupId}/balances`}
              className="flex items-center gap-3 rounded-lg p-1.5 text-sm transition-colors hover:bg-accent"
            >
              <MemberAvatar id={g.groupId} name={g.groupName} size="sm" />
              <span className="min-w-0 flex-1 truncate">{g.groupName}</span>
              {g.netCents === 0 ? (
                <span className="shrink-0 text-muted-foreground">{t("settledUp")}</span>
              ) : (
                <Money
                  cents={Math.abs(g.netCents)}
                  currency={g.baseCurrency}
                  tone={netTone(g.netCents)}
                  size="sm"
                  className="shrink-0"
                />
              )}
            </Link>
          ))}
        </CardContent>
      </Card>

      {!hasPaymentMethod && groupRows.length > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          {t("addPaymentMethodHint")}{" "}
          <Link href="/account" className="text-mekong underline">
            {t("addPaymentMethodLink")}
          </Link>
        </p>
      )}
    </div>
  );
}
