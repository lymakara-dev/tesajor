import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateGroupForm } from "@/components/create-group-form";
import { Users } from "lucide-react";

export default async function GroupsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const t = await getTranslations("groupsList");

  const memberships = await db
    .select({
      groupId: groups.id,
      name: groups.name,
      baseCurrency: groups.baseCurrency,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(eq(groupMembers.userId, session.user.id));

  return (
    <div className="mx-auto max-w-[480px] px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <CreateGroupForm />

      <div className="space-y-4">
        {memberships.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        )}
        {memberships.map((m) => (
          <Link key={m.groupId} href={`/groups/${m.groupId}`}>
            <Card className="transition-[background-color,box-shadow] hover:bg-accent hover:elevation-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="size-4 text-mekong" strokeWidth={1.5} />
                  {m.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {t("baseCurrency", { currency: m.baseCurrency })}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
