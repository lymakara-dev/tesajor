"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { requestPaymentsViaTelegram } from "@/lib/actions/payment-requests";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

export function RequestPaymentsButton({
  groupId,
  variant = "outline",
}: {
  groupId: string;
  /** "khqr": compact white pill for embedding on the krama-red KHQR summary card. */
  variant?: "outline" | "khqr";
}) {
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
    <div className={variant === "khqr" ? "shrink-0" : undefined}>
      <Button
        type="button"
        variant={variant === "khqr" ? "ghost" : "outline"}
        size={variant === "khqr" ? "sm" : "default"}
        className={
          variant === "khqr"
            ? "h-auto w-24 shrink-0 flex-col gap-1 whitespace-normal text-center leading-tight bg-rice text-krama hover:bg-rice/90 hover:text-krama"
            : undefined
        }
        onClick={onClick}
        disabled={submitting}
      >
        <Send className="size-4" strokeWidth={1.5} />
        {submitting ? t("sending") : t("requestViaTelegram")}
      </Button>
      {message && (
        <p
          className={
            variant === "khqr"
              ? "mt-2 text-xs text-rice/80"
              : "mt-2 text-sm text-muted-foreground"
          }
        >
          {message}
        </p>
      )}
    </div>
  );
}
