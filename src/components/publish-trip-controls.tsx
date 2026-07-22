"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { publishTrip } from "@/lib/actions/trips";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const OPTIONS = [
  { value: "private", label: "Private", hint: "Only invited members can see this trip." },
  { value: "link", label: "Anyone with the link", hint: "Others can view and clone it as a template." },
  { value: "public_template", label: "Public template", hint: "Discoverable and clonable by anyone." },
] as const;

export function PublishTripControls({
  tripId,
  visibility,
}: {
  tripId: string;
  visibility: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(value: string) {
    setSubmitting(true);
    setError(null);
    const result = await publishTrip({ tripId, visibility: value });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sharing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="visibility"
              value={opt.value}
              checked={visibility === opt.value}
              disabled={submitting}
              onChange={() => onChange(opt.value)}
              className="mt-1"
            />
            <span>
              <span className="font-medium">{opt.label}</span>
              <br />
              <span className="text-xs text-muted-foreground">{opt.hint}</span>
            </span>
          </label>
        ))}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
