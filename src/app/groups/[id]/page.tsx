import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { InviteLink } from "@/components/invite-link";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
  if (!group) notFound();

  const members = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.groupId, id));

  const isMember = members.some((m) => m.userId === session.user.id);
  if (!isMember) {
    redirect("/groups");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{group.name}</h1>
        <p className="text-muted-foreground">Base currency: {group.baseCurrency}</p>
      </div>

      <InviteLink inviteCode={group.inviteCode} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>
                  {member.displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{member.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {member.userId ? member.role : "placeholder · not claimed"}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
