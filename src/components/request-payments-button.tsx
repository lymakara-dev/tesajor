"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { requestPaymentsViaTelegram } from "@/lib/actions/payment-requests";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

export function RequestPaymentsButton({ groupId }: { groupId: string }) {
  const t = useTranslations("requestPayments");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onClick() {
    setSubmitting(true);
    setMessage(null);
    const result = await requestPaymentsViaTelegram(groupId);
    setSubmitting(false);

    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    const { sent, unlinked } = result.data;
    const parts: string[] = [];
    if (sent.length) parts.push(t("sentTo", { names: sent.join(", ") }));
    if (unlinked.length) {
      parts.push(
        unlinked.length === 1
          ? t("oneUnlinked", { names: unlinked.join(", ") })
          : t("manyUnlinked", { names: unlinked.join(", ") }),
      );
    }
    setMessage(parts.join(" ") || t("nothingToSend"));
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" onClick={onClick} disabled={submitting}>
        <Send className="size-4" strokeWidth={1.5} />
        {submitting ? t("sending") : t("requestViaTelegram")}
      </Button>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
