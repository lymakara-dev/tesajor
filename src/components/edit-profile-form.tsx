"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { updateProfile } from "@/lib/actions/account";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera } from "lucide-react";

export function EditProfileForm({
  name,
  email,
  image,
}: {
  name: string;
  email: string;
  image: string | null;
}) {
  const router = useRouter();
  const { update } = useSession();
  const t = useTranslations("account");
  const [currentName, setCurrentName] = useState(name);
  const [currentImage, setCurrentImage] = useState(image);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAvatarSelected(event: ChangeEvent<HTMLInputElement>) {
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
      setCurrentImage(body.url);
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const result = await updateProfile({ name: currentName, image: currentImage });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await update({ name: result.data.name, image: result.data.image });
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          {currentImage && <AvatarImage src={currentImage} alt={currentName} />}
          <AvatarFallback className="bg-mekong text-lg font-semibold text-rice">
            {currentName.trim().charAt(0).toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <Label
            htmlFor="avatar-upload"
            className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-mekong"
          >
            <Camera className="size-4" strokeWidth={1.5} />
            {uploading ? t("uploading") : t("changePhoto")}
          </Label>
          <input
            id="avatar-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={onAvatarSelected}
            disabled={uploading}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="profile-name">{t("name")}</Label>
        <Input
          id="profile-name"
          value={currentName}
          onChange={(e) => setCurrentName(e.target.value)}
          maxLength={80}
          required
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {t("email")}: {email}
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={saving || uploading}>
        {saving ? t("saving") : t("saveProfile")}
      </Button>
    </form>
  );
}
