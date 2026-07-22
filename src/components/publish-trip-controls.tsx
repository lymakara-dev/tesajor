"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { publishTrip } from "@/lib/actions/trips";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KhmerWordmark } from "@/components/trip-complete-celebration";
import { Share2 } from "lucide-react";

const OPTIONS = ["private", "link", "public_template"] as const;

export function PublishTripControls({
  tripId,
  visibility,
}: {
  tripId: string;
  visibility: string;
}) {
  const t = useTranslations("share");
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
        <CardTitle className="flex items-center gap-1.5 text-base">
          <Share2 className="size-4 text-mekong" strokeWidth={1.5} />
          {t("sharing")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <KhmerWordmark className="pb-1" />
        {OPTIONS.map((value) => (
          <label key={value} className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="visibility"
              value={value}
              checked={visibility === value}
              disabled={submitting}
              onChange={() => onChange(value)}
              className="mt-1"
            />
            <span>
              <span className="font-medium">{t(`${value}.label`)}</span>
              <br />
              <span className="text-xs text-muted-foreground">{t(`${value}.hint`)}</span>
            </span>
          </label>
        ))}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
