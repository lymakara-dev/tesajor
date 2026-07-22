"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTelegramLinkToken, disconnectTelegram } from "@/lib/actions/telegram";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send } from "lucide-react";

interface Props {
  linked: boolean;
  username: string | null;
  hasChatId: boolean;
}

export function TelegramConnectCard({ linked, username, hasChatId }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onConnect() {
    setSubmitting(true);
    setError(null);
    const result = await createTelegramLinkToken();
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    window.open(result.data.deepLinkUrl, "_blank", "noopener,noreferrer");
  }

  async function onDisconnect() {
    setSubmitting(true);
    await disconnectTelegram();
    setSubmitting(false);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base">
          <Send className="size-4 text-mekong" strokeWidth={1.5} />
          Telegram
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {linked ? (
          <>
            <p className="text-sm text-muted-foreground">
              Connected{username ? ` as @${username}` : ""}.{" "}
              {hasChatId
                ? "You can receive payment requests here."
                : "Finish connecting to receive payment requests: tap Connect once more and press Start in Telegram."}
            </p>
            <Button variant="outline" size="sm" onClick={onDisconnect} disabled={submitting}>
              Disconnect
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Connect Telegram to receive payment requests with a QR code and a
              one-tap &quot;I&apos;ve paid&quot; button.
            </p>
            <Button size="sm" onClick={onConnect} disabled={submitting}>
              {submitting ? "Opening..." : "Connect Telegram"}
            </Button>
          </>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
