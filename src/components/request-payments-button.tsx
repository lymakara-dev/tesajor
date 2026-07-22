"use client";

import { useState } from "react";
import { requestPaymentsViaTelegram } from "@/lib/actions/payment-requests";
import { Button } from "@/components/ui/button";

export function RequestPaymentsButton({ groupId }: { groupId: string }) {
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
    if (sent.length) parts.push(`Sent to ${sent.join(", ")}.`);
    if (unlinked.length) {
      parts.push(`${unlinked.join(", ")} ${unlinked.length === 1 ? "hasn't" : "haven't"} connected Telegram yet.`);
    }
    setMessage(parts.join(" ") || "Nothing to send.");
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" onClick={onClick} disabled={submitting}>
        {submitting ? "Sending..." : "Request payments via Telegram"}
      </Button>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
