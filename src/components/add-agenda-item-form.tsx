"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { addAgendaItem } from "@/lib/actions/agenda-items";
import { dollarsToCents } from "@/lib/money/cents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Plus } from "lucide-react";

const CATEGORIES = ["food", "sight", "transport", "hotel", "activity", "other"] as const;
const selectClass =
  "h-10 w-full rounded-lg border border-input bg-transparent px-3 text-base capitalize md:text-sm";

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
  const t = useTranslations("addAgendaItem");
  const [open, setOpen] = useState(false);
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
    setOpen(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" className="w-full justify-center gap-2" />}>
        <Plus className="size-4" strokeWidth={1.5} />
        {t("title")}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="item-title">{t("stopTitle")}</Label>
            <Input id="item-title" name="title" placeholder={t("stopTitlePlaceholder")} required maxLength={160} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="dayNumber">{t("day")}</Label>
              <select id="dayNumber" name="dayNumber" defaultValue={defaultDay} className={selectClass}>
                {Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    {t("dayOption", { day })}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">{t("category")}</Label>
              <select id="category" name="category" defaultValue="other" className={selectClass}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`categories.${c}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="plannedCost">{t("plannedCost", { currency })}</Label>
            <Input id="plannedCost" name="plannedCost" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="placeName">{t("place")}</Label>
            <Input id="placeName" name="placeName" placeholder={t("placePlaceholder")} maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">{t("address")}</Label>
            <Input id="address" name="address" placeholder={t("addressPlaceholder")} maxLength={300} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? t("adding") : t("addStop")}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
