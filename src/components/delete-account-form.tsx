"use client";

import { useState, type FormEvent } from "react";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { deleteAccount } from "@/lib/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TriangleAlert } from "lucide-react";

export function DeleteAccountForm({ email }: { email: string }) {
  const t = useTranslations("deleteAccount");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (confirmation !== email) {
      setError(t("typeExactly"));
      return;
    }

    setSubmitting(true);
    const result = await deleteAccount();
    if (!result.ok) {
      setSubmitting(false);
      setError(result.error);
      return;
    }
    await signOut({ callbackUrl: "/" });
  }

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <TriangleAlert className="size-4" strokeWidth={1.5} />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("explanation")}</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="confirmation">
              {t("confirmPrefix")} <span className="font-mono">{email}</span> {t("confirmSuffix")}
            </Label>
            <Input
              id="confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" variant="destructive" disabled={submitting}>
            {submitting ? t("deleting") : t("deleteMyAccount")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
