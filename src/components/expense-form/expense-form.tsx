"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createExpense, updateExpense } from "@/lib/actions/expenses";
import { centsToDollarsInput, dollarsToCents } from "@/lib/money/cents";
import { computeExpenseShares, payersSumMatches } from "@/lib/splits/calculate";
import type { SplitMethod } from "@/lib/splits/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExpenseFormInitialValues, ExpenseFormMember } from "./types";

interface ExpenseFormProps {
  groupId: string;
  currency: string;
  members: ExpenseFormMember[];
  currentMemberId: string;
  mode: "create" | "edit";
  expenseId?: string;
  initial?: ExpenseFormInitialValues;
  /** Quick-start values (e.g. from a trip journal entry) — ignored once `initial` is set. */
  prefill?: { title?: string; totalDollars?: string; payerMemberId?: string };
}

interface ItemRow {
  clientId: string;
  name: string;
  price: string;
  assignees: Record<string, boolean>;
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function newItemRow(): ItemRow {
  return {
    clientId: crypto.randomUUID(),
    name: "",
    price: "",
    assignees: {},
  };
}

export function ExpenseForm({
  groupId,
  currency,
  members,
  currentMemberId,
  mode,
  expenseId,
  initial,
  prefill,
}: ExpenseFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(initial?.title ?? prefill?.title ?? "");
  const [date, setDate] = useState(
    initial ? initial.expenseDate.toISOString().slice(0, 10) : todayInputValue(),
  );
  const [category, setCategory] = useState(initial?.category ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [receiptUrl, setReceiptUrl] = useState(initial?.receiptUrl ?? "");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(
    initial?.splitMethod ?? "equal",
  );

  const [totalInput, setTotalInput] = useState(() => {
    if (initial && initial.splitMethod !== "itemized") {
      return centsToDollarsInput(initial.totalAmountCents);
    }
    if (!initial && prefill?.totalDollars) return prefill.totalDollars;
    return "";
  });

  const [payers, setPayers] = useState<Record<string, { included: boolean; amount: string }>>(
    () => {
      const state: Record<string, { included: boolean; amount: string }> = {};
      for (const m of members) state[m.id] = { included: false, amount: "" };
      if (initial) {
        for (const p of initial.payers) {
          state[p.memberId] = { included: true, amount: centsToDollarsInput(p.paidAmountCents) };
        }
      } else {
        const payerId =
          prefill?.payerMemberId && members.some((m) => m.id === prefill.payerMemberId)
            ? prefill.payerMemberId
            : currentMemberId;
        state[payerId] = { included: true, amount: prefill?.totalDollars ?? "" };
      }
      return state;
    },
  );

  const [equalIncluded, setEqualIncluded] = useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {};
    if (initial?.splitMethod === "equal") {
      for (const m of members) state[m.id] = initial.participantMemberIds.includes(m.id);
    } else {
      for (const m of members) state[m.id] = true;
    }
    return state;
  });

  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>(() => {
    const state: Record<string, string> = {};
    if (initial?.splitMethod === "exact") {
      for (const s of initial.shares) state[s.memberId] = centsToDollarsInput(s.owedAmountCents);
    }
    return state;
  });

  const [percentValues, setPercentValues] = useState<Record<string, string>>(() => {
    const state: Record<string, string> = {};
    if (initial?.splitMethod === "percent") {
      for (const s of initial.shares) state[s.memberId] = (s.percentBasisPoints / 100).toFixed(2);
    }
    return state;
  });

  const [shareCounts, setShareCounts] = useState<Record<string, string>>(() => {
    const state: Record<string, string> = {};
    if (initial?.splitMethod === "shares") {
      for (const s of initial.shares) state[s.memberId] = String(s.shareCount);
    }
    return state;
  });

  const [items, setItems] = useState<ItemRow[]>(() => {
    if (initial?.splitMethod === "itemized") {
      return initial.items.map((item) => ({
        clientId: crypto.randomUUID(),
        name: item.name,
        price: centsToDollarsInput(item.priceCents),
        assignees: Object.fromEntries(item.assigneeMemberIds.map((id) => [id, true])),
      }));
    }
    return [newItemRow()];
  });

  const [taxTip, setTaxTip] = useState(() => {
    if (initial?.splitMethod === "itemized") {
      const itemsTotal = initial.items.reduce((sum, i) => sum + i.priceCents, 0);
      return centsToDollarsInput(initial.totalAmountCents - itemsTotal);
    }
    return "0.00";
  });

  const itemizedTotalCents = useMemo(() => {
    const itemsCents = items.reduce((sum, i) => sum + (dollarsToCents(i.price) ?? 0), 0);
    return itemsCents + (dollarsToCents(taxTip) ?? 0);
  }, [items, taxTip]);

  function updateItem(clientId: string, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((i) => (i.clientId === clientId ? { ...i, ...patch } : i)));
  }

  function toggleItemAssignee(clientId: string, memberId: string) {
    setItems((prev) =>
      prev.map((i) =>
        i.clientId === clientId
          ? { ...i, assignees: { ...i.assignees, [memberId]: !i.assignees[memberId] } }
          : i,
      ),
    );
  }

  async function onReceiptSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingReceipt(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body: formData });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Failed to upload receipt.");
        return;
      }
      setReceiptUrl(body.url);
    } finally {
      setUploadingReceipt(false);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    const totalAmountCents =
      splitMethod === "itemized" ? itemizedTotalCents : dollarsToCents(totalInput) ?? 0;
    if (totalAmountCents <= 0) {
      setError("Total amount must be greater than zero.");
      return;
    }

    const payerEntries = Object.entries(payers)
      .filter(([, v]) => v.included)
      .map(([memberId, v]) => ({ memberId, paidAmountCents: dollarsToCents(v.amount) ?? 0 }));
    if (payerEntries.length === 0) {
      setError("Select at least one payer.");
      return;
    }
    if (!payersSumMatches(payerEntries, totalAmountCents)) {
      setError("Payer amounts must sum to the total.");
      return;
    }

    let splitPayload:
      | { splitMethod: "equal"; participantMemberIds: string[] }
      | { splitMethod: "exact"; shares: { memberId: string; owedAmountCents: number }[] }
      | { splitMethod: "percent"; shares: { memberId: string; percentBasisPoints: number }[] }
      | { splitMethod: "shares"; shares: { memberId: string; shareCount: number }[] }
      | {
          splitMethod: "itemized";
          items: { name: string; priceCents: number; assigneeMemberIds: string[] }[];
        };

    let computeInput: Parameters<typeof computeExpenseShares>[2];

    if (splitMethod === "equal") {
      const participantMemberIds = Object.entries(equalIncluded)
        .filter(([, included]) => included)
        .map(([id]) => id);
      splitPayload = { splitMethod: "equal", participantMemberIds };
      computeInput = { participants: participantMemberIds.map((memberId) => ({ memberId })) };
    } else if (splitMethod === "exact") {
      const shares = Object.entries(exactAmounts)
        .filter(([, v]) => v.trim() !== "")
        .map(([memberId, v]) => ({ memberId, owedAmountCents: dollarsToCents(v) ?? 0 }));
      splitPayload = { splitMethod: "exact", shares };
      computeInput = { exact: shares };
    } else if (splitMethod === "percent") {
      const shares = Object.entries(percentValues)
        .filter(([, v]) => v.trim() !== "")
        .map(([memberId, v]) => ({
          memberId,
          percentBasisPoints: Math.round(Number(v) * 100),
        }));
      splitPayload = { splitMethod: "percent", shares };
      computeInput = { percent: shares };
    } else if (splitMethod === "shares") {
      const shares = Object.entries(shareCounts)
        .filter(([, v]) => v.trim() !== "" && Number(v) > 0)
        .map(([memberId, v]) => ({ memberId, shareCount: Math.round(Number(v)) }));
      splitPayload = { splitMethod: "shares", shares };
      computeInput = { shares };
    } else {
      const itemsPayload = items
        .filter((i) => i.name.trim() !== "")
        .map((i) => ({
          name: i.name.trim(),
          priceCents: dollarsToCents(i.price) ?? 0,
          assigneeMemberIds: Object.entries(i.assignees)
            .filter(([, checked]) => checked)
            .map(([id]) => id),
        }));
      splitPayload = { splitMethod: "itemized", items: itemsPayload };
      computeInput = { items: itemsPayload };
    }

    const clientCheck = computeExpenseShares(splitMethod, totalAmountCents, computeInput);
    if (!clientCheck.ok) {
      setError(clientCheck.error);
      return;
    }

    setSubmitting(true);

    const expensePayload = {
      groupId,
      title: title.trim(),
      totalAmountCents,
      currency,
      category: category.trim() || undefined,
      note: note.trim() || undefined,
      receiptUrl: receiptUrl || undefined,
      expenseDate: new Date(date),
      payers: payerEntries,
      ...splitPayload,
    };

    const result =
      mode === "edit" && expenseId
        ? await updateExpense({ expenseId, expense: expensePayload })
        : await createExpense(expensePayload);

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/groups/${groupId}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 pb-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Dinner at Nomz"
              required
              maxLength={120}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Food"
                maxLength={60}
              />
            </div>
          </div>
          {splitMethod !== "itemized" && (
            <div className="space-y-2">
              <Label htmlFor="total">Total ({currency})</Label>
              <Input
                id="total"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={totalInput}
                onChange={(e) => setTotalInput(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="receipt">Receipt photo</Label>
            {receiptUrl && (
              <Image
                src={receiptUrl}
                alt="Receipt"
                width={96}
                height={96}
                className="h-24 w-24 rounded-md border object-cover"
              />
            )}
            <Input
              id="receipt"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={onReceiptSelected}
              disabled={uploadingReceipt}
            />
            {uploadingReceipt && (
              <p className="text-sm text-muted-foreground">Uploading...</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Who paid?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3" data-testid={`payer-row-${m.id}`}>
              <Checkbox
                data-testid={`payer-checkbox-${m.id}`}
                checked={payers[m.id]?.included ?? false}
                onCheckedChange={(checked) =>
                  setPayers((prev) => ({
                    ...prev,
                    [m.id]: { included: Boolean(checked), amount: prev[m.id]?.amount ?? "" },
                  }))
                }
              />
              <span className="flex-1 text-sm">{m.displayName}</span>
              <Input
                data-testid={`payer-amount-${m.id}`}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className="w-28"
                disabled={!payers[m.id]?.included}
                value={payers[m.id]?.amount ?? ""}
                onChange={(e) =>
                  setPayers((prev) => ({
                    ...prev,
                    [m.id]: { included: true, amount: e.target.value },
                  }))
                }
                placeholder="0.00"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Split method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={splitMethod}
            onValueChange={(v) => setSplitMethod(v as SplitMethod)}
            className="grid grid-cols-2 gap-2 sm:grid-cols-5"
          >
            {(["equal", "exact", "percent", "shares", "itemized"] as const).map((method) => (
              <label
                key={method}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm capitalize has-[[data-state=checked]]:border-primary"
              >
                <RadioGroupItem value={method} data-testid={`split-method-${method}`} />
                {method}
              </label>
            ))}
          </RadioGroup>

          {splitMethod === "equal" && (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3" data-testid={`equal-row-${m.id}`}>
                  <Checkbox
                    data-testid={`equal-checkbox-${m.id}`}
                    checked={equalIncluded[m.id] ?? false}
                    onCheckedChange={(checked) =>
                      setEqualIncluded((prev) => ({ ...prev, [m.id]: Boolean(checked) }))
                    }
                  />
                  <span className="text-sm">{m.displayName}</span>
                </div>
              ))}
            </div>
          )}

          {splitMethod === "exact" && (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3" data-testid={`exact-row-${m.id}`}>
                  <span className="flex-1 text-sm">{m.displayName}</span>
                  <Input
                    data-testid={`exact-amount-${m.id}`}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className="w-28"
                    value={exactAmounts[m.id] ?? ""}
                    onChange={(e) =>
                      setExactAmounts((prev) => ({ ...prev, [m.id]: e.target.value }))
                    }
                    placeholder="0.00"
                  />
                </div>
              ))}
            </div>
          )}

          {splitMethod === "percent" && (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3" data-testid={`percent-row-${m.id}`}>
                  <span className="flex-1 text-sm">{m.displayName}</span>
                  <div className="flex items-center gap-1">
                    <Input
                      data-testid={`percent-amount-${m.id}`}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      max="100"
                      className="w-24"
                      value={percentValues[m.id] ?? ""}
                      onChange={(e) =>
                        setPercentValues((prev) => ({ ...prev, [m.id]: e.target.value }))
                      }
                      placeholder="0"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {splitMethod === "shares" && (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3" data-testid={`shares-row-${m.id}`}>
                  <span className="flex-1 text-sm">{m.displayName}</span>
                  <Input
                    data-testid={`shares-amount-${m.id}`}
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="0"
                    className="w-20"
                    value={shareCounts[m.id] ?? ""}
                    onChange={(e) =>
                      setShareCounts((prev) => ({ ...prev, [m.id]: e.target.value }))
                    }
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          )}

          {splitMethod === "itemized" && (
            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={item.clientId}
                  className="space-y-2 rounded-md border p-3"
                  data-testid={`item-row-${index}`}
                >
                  <div className="flex gap-2">
                    <Input
                      data-testid={`item-name-${index}`}
                      value={item.name}
                      onChange={(e) => updateItem(item.clientId, { name: e.target.value })}
                      placeholder="Item name"
                      className="flex-1"
                    />
                    <Input
                      data-testid={`item-price-${index}`}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      className="w-24"
                      value={item.price}
                      onChange={(e) => updateItem(item.clientId, { price: e.target.value })}
                      placeholder="0.00"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setItems((prev) => prev.filter((i) => i.clientId !== item.clientId))}
                      disabled={items.length === 1}
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {members.map((m) => (
                      <label key={m.id} className="flex items-center gap-1.5 text-sm">
                        <Checkbox
                          data-testid={`item-assignee-${index}-${m.id}`}
                          checked={item.assignees[m.id] ?? false}
                          onCheckedChange={() => toggleItemAssignee(item.clientId, m.id)}
                        />
                        {m.displayName}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="add-item"
                onClick={() => setItems((prev) => [...prev, newItemRow()])}
              >
                Add item
              </Button>
              <div className="flex items-center gap-3">
                <Label htmlFor="taxTip" className="w-28">
                  Tax &amp; tip
                </Label>
                <Input
                  id="taxTip"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className="w-28"
                  value={taxTip}
                  onChange={(e) => setTaxTip(e.target.value)}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Total: {(itemizedTotalCents / 100).toFixed(2)} {currency}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive" data-testid="form-error">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting} data-testid="submit-expense">
          {submitting ? "Saving..." : mode === "edit" ? "Save changes" : "Add expense"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
