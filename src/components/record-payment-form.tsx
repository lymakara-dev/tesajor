"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { recordSettlement } from "@/lib/actions/settlements";
import { dollarsToCents } from "@/lib/money/cents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HandCoins } from "lucide-react";

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-transparent px-3 text-base md:text-sm";

interface Member {
  id: string;
  displayName: string;
}

export function RecordPaymentForm({
  groupId,
  members,
}: {
  groupId: string;
  members: Member[];
}) {
  const router = useRouter();
  const t = useTranslations("recordPayment");
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
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HandCoins className="size-4 text-mekong" strokeWidth={1.5} />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="from">{t("from")}</Label>
              <select id="from" name="from" required defaultValue="" className={selectClass}>
                <option value="" disabled>
                  {t("selectMember")}
                </option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">{t("to")}</Label>
              <select id="to" name="to" required defaultValue="" className={selectClass}>
                <option value="" disabled>
                  {t("selectMember")}
                </option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">{t("amount")}</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
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
          <Button type="submit" disabled={submitting}>
            {submitting ? t("recording") : t("recordPayment")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
