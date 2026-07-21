"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function InviteLink({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/groups/join/${inviteCode}`
      : `/groups/join/${inviteCode}`;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Invite friends</CardTitle>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Input readOnly value={url} />
        <Button variant="outline" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </CardContent>
    </Card>
  );
}
