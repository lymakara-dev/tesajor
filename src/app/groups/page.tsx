import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateGroupForm } from "@/components/create-group-form";

export default async function GroupsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

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
        <h1 className="text-2xl font-semibold">Your groups</h1>
        <p className="text-muted-foreground">
          Create a group or open one you already belong to.
        </p>
      </div>

      <CreateGroupForm />

      <div className="space-y-3">
        {memberships.length === 0 && (
          <p className="text-sm text-muted-foreground">
            You&apos;re not in any groups yet.
          </p>
        )}
        {memberships.map((m) => (
          <Link key={m.groupId} href={`/groups/${m.groupId}`}>
            <Card className="transition-colors hover:bg-accent">
              <CardHeader>
                <CardTitle className="text-base">{m.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Base currency: {m.baseCurrency}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
