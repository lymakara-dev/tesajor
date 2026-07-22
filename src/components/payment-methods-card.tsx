"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { addPaymentMethod, deletePaymentMethod } from "@/lib/actions/payment-methods";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface PaymentMethodRow {
  id: string;
  label: string;
  qrImageUrl: string | null;
  paymentLink: string | null;
  isDefault: boolean;
}

export function PaymentMethodsCard({ methods }: { methods: PaymentMethodRow[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [paymentLink, setPaymentLink] = useState("");
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [isDefault, setIsDefault] = useState(methods.length === 0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body: formData });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Failed to upload QR image.");
        return;
      }
      setQrImageUrl(body.url);
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!qrImageUrl && !paymentLink.trim()) {
      setError("Upload a QR image or enter a payment link.");
      return;
    }

    setSubmitting(true);
    const result = await addPaymentMethod({
      label: label.trim(),
      qrImageUrl: qrImageUrl || undefined,
      paymentLink: paymentLink.trim() || undefined,
      isDefault,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLabel("");
    setPaymentLink("");
    setQrImageUrl("");
    setIsDefault(false);
    router.refresh();
  }

  async function onDelete(id: string) {
    await deletePaymentMethod({ paymentMethodId: id });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payment methods</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {methods.map((m) => (
          <div key={m.id} className="flex items-center gap-3">
            {m.qrImageUrl && (
              <Image
                src={m.qrImageUrl}
                alt={m.label}
                width={48}
                height={48}
                className="rounded-md border object-cover"
              />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">
                {m.label} {m.isDefault && <span className="text-xs text-muted-foreground">(default)</span>}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onDelete(m.id)}>
              Delete
            </Button>
          </div>
        ))}

        <form onSubmit={onSubmit} className="space-y-3 border-t pt-4">
          <div className="space-y-2">
            <Label htmlFor="pm-label">Label</Label>
            <Input
              id="pm-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="KBank QR, PayPal..."
              maxLength={60}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pm-qr">QR image</Label>
            {qrImageUrl && (
              <Image src={qrImageUrl} alt="QR preview" width={64} height={64} className="rounded-md border" />
            )}
            <Input id="pm-qr" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onFileSelected} disabled={uploading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pm-link">Or a payment link (we&apos;ll generate a QR)</Label>
            <Input
              id="pm-link"
              type="url"
              value={paymentLink}
              onChange={(e) => setPaymentLink(e.target.value)}
              placeholder="https://paypal.me/you"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isDefault} onCheckedChange={(c) => setIsDefault(Boolean(c))} />
            Set as default
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="sm" disabled={submitting || uploading}>
            {submitting ? "Adding..." : "Add payment method"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
