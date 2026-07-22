"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { addPaymentMethod, deletePaymentMethod } from "@/lib/actions/payment-methods";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";

export interface PaymentMethodRow {
  id: string;
  label: string;
  qrImageUrl: string | null;
  paymentLink: string | null;
  isDefault: boolean;
}

export function PaymentMethodsCard({
  methods,
  ownerName,
}: {
  methods: PaymentMethodRow[];
  ownerName: string;
}) {
  const t = useTranslations("paymentMethods");
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
        setError(body.error ?? t("uploadFailed"));
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
      setError(t("needQrOrLink"));
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
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {methods.map((m) => (
          <div
            key={m.id}
            className="relative flex items-center gap-3 overflow-hidden rounded-xl bg-krama p-3 text-rice"
          >
            <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-white p-1">
              {m.qrImageUrl ? (
                <Image
                  src={m.qrImageUrl}
                  alt={m.label}
                  width={48}
                  height={48}
                  className="size-full rounded-sm object-cover"
                />
              ) : (
                <span className="text-[10px] font-medium text-krama">QR</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="amount truncate text-sm font-bold">{m.label || t("khqrDefaultLabel")}</p>
              <p className="truncate text-xs text-rice/80">{ownerName}</p>
              {m.isDefault && (
                <span className="mt-0.5 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium">
                  {t("default")}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-rice hover:bg-white/15 hover:text-rice"
              onClick={() => onDelete(m.id)}
              aria-label={t("delete")}
            >
              <X className="size-4" strokeWidth={1.5} />
            </Button>
          </div>
        ))}

        <form onSubmit={onSubmit} className="space-y-3 border-t border-sandstone pt-4">
          <div className="space-y-2">
            <Label htmlFor="pm-label">{t("label")}</Label>
            <Input
              id="pm-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("labelPlaceholder")}
              maxLength={60}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pm-qr">{t("qrImage")}</Label>
            {qrImageUrl && (
              <Image src={qrImageUrl} alt="QR preview" width={64} height={64} className="rounded-md border border-sandstone" />
            )}
            <Input id="pm-qr" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onFileSelected} disabled={uploading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pm-link">{t("orPaymentLink")}</Label>
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
            {t("setAsDefault")}
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="sm" disabled={submitting || uploading}>
            {submitting ? t("adding") : t("addPaymentMethod")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
