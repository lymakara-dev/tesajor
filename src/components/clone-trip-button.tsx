"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { cloneTrip } from "@/lib/actions/trips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CloneTripButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const result = await cloneTrip({ tripId, newStartDate: formData.get("newStartDate") });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/trips/${result.data.tripId}`);
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Use this template
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Clone this trip</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="newStartDate">Your start date</Label>
            <Input id="newStartDate" name="newStartDate" type="date" required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Cloning..." : "Clone trip"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
