import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { ExpenseForm } from "@/components/expense-form/expense-form";

export default async function NewExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ title?: string; amount?: string; payerMemberId?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
  if (!group) notFound();

  const members = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.groupId, id));

  const currentMember = members.find((m) => m.userId === session.user.id);
  if (!currentMember) redirect("/groups");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Add expense</h1>
      <ExpenseForm
        groupId={group.id}
        currency={group.baseCurrency}
        currentMemberId={currentMember.id}
        mode="create"
        members={members.map((m) => ({ id: m.id, displayName: m.displayName }))}
        prefill={{
          title: query.title,
          totalDollars: query.amount,
          payerMemberId: query.payerMemberId,
        }}
      />
    </div>
  );
}
