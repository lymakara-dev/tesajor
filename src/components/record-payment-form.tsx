"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { recordSettlement } from "@/lib/actions/settlements";
import { dollarsToCents } from "@/lib/money/cents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConvertibleAmountInput } from "@/components/convertible-amount-input";
import { HandCoins } from "lucide-react";

interface Member {
  id: string;
  displayName: string;
}

export function RecordPaymentForm({
  groupId,
  members,
  baseCurrency,
  usdKhrRate,
}: {
  groupId: string;
  members: Member[];
  baseCurrency: string;
  usdKhrRate: number;
}) {
  const router = useRouter();
  const t = useTranslations("recordPayment");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const fromMemberId = String(formData.get("from"));
    const toMemberId = String(formData.get("to"));
    const amountCents = dollarsToCents(String(formData.get("amount") ?? ""));

    if (fromMemberId === toMemberId) {
      setError(t("samePerson"));
      return;
    }
    if (!amountCents || amountCents <= 0) {
      setError(t("invalidAmount"));
      return;
    }

    setSubmitting(true);
    const result = await recordSettlement({
      groupId,
      fromMemberId,
      toMemberId,
      amountCents,
      method: String(formData.get("method") ?? "").trim() || undefined,
      note: String(formData.get("note") ?? "").trim() || undefined,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    form.reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" data-testid="record-payment-trigger" />}>
        <HandCoins className="size-4" strokeWidth={1.5} />
        {t("title")}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="from">{t("from")}</Label>
              <Select name="from" required>
                <SelectTrigger id="from">
                  <SelectValue placeholder={t("selectMember")}>
                    {(value: string) => members.find((m) => m.id === value)?.displayName}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">{t("to")}</Label>
              <Select name="to" required>
                <SelectTrigger id="to">
                  <SelectValue placeholder={t("selectMember")}>
                    {(value: string) => members.find((m) => m.id === value)?.displayName}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">{t("amount")}</Label>
              <ConvertibleAmountInput
                id="amount"
                name="amount"
                data-testid="record-payment-amount"
                baseCurrency={baseCurrency}
                usdKhrRate={usdKhrRate}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="method">{t("method")}</Label>
              <Input id="method" name="method" placeholder={t("methodPlaceholder")} maxLength={60} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">{t("note")}</Label>
            <Input id="note" name="note" maxLength={500} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full" data-testid="submit-record-payment">
            {submitting ? t("recording") : t("recordPayment")}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
