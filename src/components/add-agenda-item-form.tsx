"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { addAgendaItem } from "@/lib/actions/agenda-items";
import { dollarsToCents } from "@/lib/money/cents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CATEGORIES = ["food", "sight", "transport", "hotel", "activity", "other"] as const;

export function AddAgendaItemForm({
  tripId,
  dayCount,
  defaultDay,
  currency,
}: {
  tripId: string;
  dayCount: number;
  defaultDay: number;
  currency: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const costInput = String(formData.get("plannedCost") ?? "");

    const result = await addAgendaItem({
      tripId,
      dayNumber: Number(formData.get("dayNumber")),
      title: formData.get("title"),
      category: formData.get("category"),
      plannedCostCents: costInput.trim() ? dollarsToCents(costInput) ?? undefined : undefined,
      currency,
      placeName: String(formData.get("placeName") ?? "").trim() || undefined,
      address: String(formData.get("address") ?? "").trim() || undefined,
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    (event.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add a stop</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="item-title">Title</Label>
            <Input id="item-title" name="title" placeholder="Fushimi Inari Shrine" required maxLength={160} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="dayNumber">Day</Label>
              <select
                id="dayNumber"
                name="dayNumber"
                defaultValue={defaultDay}
                className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm"
              >
                {Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    Day {day}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                name="category"
                defaultValue="other"
                className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm capitalize"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="plannedCost">Planned cost ({currency})</Label>
            <Input id="plannedCost" name="plannedCost" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="placeName">Place (optional)</Label>
            <Input id="placeName" name="placeName" placeholder="Place name" maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address (optional)</Label>
            <Input id="address" name="address" placeholder="Address" maxLength={300} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding..." : "Add stop"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
