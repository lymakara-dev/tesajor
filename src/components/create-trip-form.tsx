"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createTrip } from "@/lib/actions/trips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUPPORTED_CURRENCIES } from "@/lib/money/currency";
import { Plus } from "lucide-react";

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CreateTripForm({ groups }: { groups: { id: string; name: string }[] }) {
  const router = useRouter();
  const t = useTranslations("createTrip");
  const [open, setOpen] = useState(false);
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
    setOpen(false);
    router.push(`/trips/${result.data.tripId}`);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button className="w-full justify-center gap-2" />}>
        <Plus className="size-4" strokeWidth={1.5} />
        {t("trigger")}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="trip-title">{t("tripTitle")}</Label>
            <Input id="trip-title" name="title" placeholder={t("tripTitlePlaceholder")} required maxLength={120} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">{t("startDate")}</Label>
              <DateInput id="startDate" name="startDate" defaultValue={todayInputValue()} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">{t("endDate")}</Label>
              <DateInput id="endDate" name="endDate" defaultValue={todayInputValue()} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="baseCurrency">{t("currency")}</Label>
            <Select name="baseCurrency" defaultValue="USD">
              <SelectTrigger id="baseCurrency" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {groups.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="groupId">{t("linkGroup")}</Label>
              <Select name="groupId" defaultValue="">
                <SelectTrigger id="groupId">
                  <SelectValue placeholder={t("noGroup")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("noGroup")}</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("linkGroupHint")}</p>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? t("creating") : t("create")}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
