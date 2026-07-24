"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeftRight } from "lucide-react";

/**
 * Lets a group/trip owner set the riel-per-USD rate used to convert any
 * amount a member types in the other currency (see ConvertibleAmountInput)
 * back into the group's/trip's own centralized currency. `onSave` is a
 * bound server action call — this component doesn't know or care whether
 * it's updating a group or a trip.
 */
export function ExchangeRateSettings({
  currentRate,
  onSave,
}: {
  currentRate: number;
  onSave: (rate: number) => Promise<{ ok: boolean; error?: string }>;
}) {
  const t = useTranslations("exchangeRate");
  const [value, setValue] = useState(String(currentRate));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const rate = Math.round(Number(value));
    if (!Number.isFinite(rate) || rate <= 0) {
      setError(t("invalidRate"));
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await onSave(rate);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? t("invalidRate"));
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowLeftRight className="size-4 text-mekong" strokeWidth={1.5} />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-2">
          <Label htmlFor="usdKhrRate">{t("label")}</Label>

          <div className="flex items-end gap-2">
            <Input
              id="usdKhrRate"
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="flex-1"
            />

            <Button
              type="submit"
              disabled={saving}
              className="rounded-lg"
              data-testid="save-exchange-rate"
            >
              {saving ? t("saving") : saved ? t("saved") : t("save")}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {t("hint")}
          </p>
        </form>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
