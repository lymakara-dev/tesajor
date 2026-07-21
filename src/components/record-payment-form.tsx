"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { recordSettlement } from "@/lib/actions/settlements";
import { dollarsToCents } from "@/lib/money/cents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Member {
  id: string;
  displayName: string;
}

export function RecordPaymentForm({
  groupId,
  members,
}: {
  groupId: string;
  members: Member[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const fromMemberId = String(formData.get("from"));
    const toMemberId = String(formData.get("to"));
    const amountCents = dollarsToCents(String(formData.get("amount") ?? ""));

    if (fromMemberId === toMemberId) {
      setError("Payer and recipient must be different people.");
      return;
    }
    if (!amountCents || amountCents <= 0) {
      setError("Enter a valid amount.");
      return;
    }

    setSubmitting(true);
    const result = await recordSettlement({
      groupId,
      fromMemberId,
      toMemberId,
      amountCents,
      method: String(formData.get("method") ?? "").trim() || undefined,
      note: String(formData.get("note") ?? "").trim() || undefined,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    form.reset();
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Record a payment</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="from">From</Label>
              <select
                id="from"
                name="from"
                required
                defaultValue=""
                className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="" disabled>
                  Select member
                </option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">To</Label>
              <select
                id="to"
                name="to"
                required
                defaultValue=""
                className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="" disabled>
                  Select member
                </option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="method">Method</Label>
              <Input id="method" name="method" placeholder="Cash, Venmo..." maxLength={60} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Input id="note" name="note" maxLength={500} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Recording..." : "Record payment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
