"use client";

import { useState, type FormEvent } from "react";
import { signOut } from "next-auth/react";
import { deleteAccount } from "@/lib/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DeleteAccountForm({ email }: { email: string }) {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (confirmation !== email) {
      setError("Type your email exactly to confirm.");
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
        <CardTitle className="text-base text-destructive">Delete account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          This removes your name, email, and login from your account and any
          groups you belong to. Expenses and settlements you were part of
          stay so other members&apos; balances remain accurate, but are no
          longer linked to your identity. This can&apos;t be undone.
        </p>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="confirmation">
              Type <span className="font-mono">{email}</span> to confirm
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
            {submitting ? "Deleting..." : "Delete my account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
