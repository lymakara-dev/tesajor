"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function InviteLink({
  inviteCode,
  joinPath = "/groups/join",
  title,
}: {
  inviteCode: string;
  joinPath?: string;
  title?: string;
}) {
  const t = useTranslations("inviteLink");
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}${joinPath}/${inviteCode}`
      : `${joinPath}/${inviteCode}`;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title ?? t("defaultTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Input readOnly value={url} />
        <Button variant="outline" onClick={copy}>
          {copied ? t("copied") : t("copy")}
        </Button>
      </CardContent>
    </Card>
  );
}
