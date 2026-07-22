"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createTrip } from "@/lib/actions/trips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CreateTripForm({ groups }: { groups: { id: string; name: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const groupId = String(formData.get("groupId") ?? "");
    const result = await createTrip({
      title: formData.get("title"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      baseCurrency: formData.get("baseCurrency") || "USD",
      groupId: groupId || undefined,
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/trips/${result.data.tripId}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New trip</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="trip-title">Title</Label>
            <Input id="trip-title" name="title" placeholder="Japan 2026" required maxLength={120} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" name="startDate" type="date" defaultValue={todayInputValue()} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End date</Label>
              <Input id="endDate" name="endDate" type="date" defaultValue={todayInputValue()} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="baseCurrency">Currency</Label>
            <Input id="baseCurrency" name="baseCurrency" defaultValue="USD" maxLength={3} className="w-20" />
          </div>
          {groups.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="groupId">Link to a group (optional)</Label>
              <select
                id="groupId"
                name="groupId"
                defaultValue=""
                className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-base md:text-sm"
              >
                <option value="">No group — just for me</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Lets you turn journaled prices into group expenses in one tap.
              </p>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create trip"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
