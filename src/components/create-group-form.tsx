"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createGroup } from "@/lib/actions/groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CreateGroupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const result = await createGroup({
      name: formData.get("name"),
      baseCurrency: formData.get("baseCurrency") || "USD",
    });

    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/groups/${result.data.groupId}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New group</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              placeholder="Friday Dinner Crew"
              required
              maxLength={80}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="baseCurrency">Currency</Label>
            <Input
              id="baseCurrency"
              name="baseCurrency"
              defaultValue="USD"
              maxLength={3}
              className="w-20 uppercase"
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create group"}
          </Button>
        </form>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
