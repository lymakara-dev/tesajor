import { and, eq, inArray, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { expensePayers, expenses, groupMembers, groups } from "@/db/schema";
import { auth } from "@/lib/auth";
import { centsToDollarsInput } from "@/lib/money/cents";

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(",") + "\r\n";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { id } = await params;

  const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
  if (!group) {
    return NextResponse.json({ error: "Group not found." }, { status: 404 });
  }

  const members = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.groupId, id));
  const isMember = members.some((m) => m.userId === session.user.id);
  if (!isMember) {
    return NextResponse.json({ error: "You are not a member of this group." }, { status: 403 });
  }

  const memberName = new Map(members.map((m) => [m.id, m.displayName]));

  const expenseRows = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.groupId, id), isNull(expenses.deletedAt)))
    .orderBy(expenses.expenseDate);

  const payersByExpense = new Map<string, string[]>();
  if (expenseRows.length > 0) {
    const payerRows = await db
      .select()
      .from(expensePayers)
      .where(
        inArray(
          expensePayers.expenseId,
          expenseRows.map((e) => e.id),
        ),
      );
    for (const p of payerRows) {
      const names = payersByExpense.get(p.expenseId) ?? [];
      names.push(memberName.get(p.memberId) ?? "Unknown");
      payersByExpense.set(p.expenseId, names);
    }
  }

  let csv = toCsvRow([
    "Date",
    "Title",
    "Category",
    "Split method",
    "Total",
    "Currency",
    "Paid by",
    "Note",
  ]);

  for (const expense of expenseRows) {
    csv += toCsvRow([
      expense.expenseDate.toISOString().slice(0, 10),
      expense.title,
      expense.category ?? "",
      expense.splitMethod,
      centsToDollarsInput(expense.totalAmountCents),
      expense.currency,
      (payersByExpense.get(expense.id) ?? []).join("; "),
      expense.note ?? "",
    ]);
  }

  const filename = `${group.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-expenses.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
