"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { setVoicePreferences } from "@/lib/actions/voice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Volume2 } from "lucide-react";

interface Props {
  enabled: boolean;
  locale: string;
}

/** /account section for the trip voice companion: on/off + voice language
 * (default Khmer). Saves on change. */
export function VoiceSettingsCard({ enabled: initialEnabled, locale: initialLocale }: Props) {
  const t = useTranslations("voice");
  const [enabled, setEnabled] = useState(initialEnabled);
  const [locale, setLocale] = useState(initialLocale === "en" ? "en" : "km");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(nextEnabled: boolean, nextLocale: string) {
    setError(null);
    setSaved(false);
    const result = await setVoicePreferences({
      enabled: nextEnabled,
      locale: nextLocale,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Volume2 className="size-4 text-mekong" strokeWidth={1.5} />
          {t("settingsTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("settingsHint")}</p>
        <div className="flex items-center gap-2">
          <Checkbox
            id="voice-enabled"
            checked={enabled}
            onCheckedChange={(checked) => {
              const next = checked === true;
              setEnabled(next);
              void save(next, locale);
            }}
          />
          <Label htmlFor="voice-enabled">{t("enabled")}</Label>
        </div>
        {enabled && (
          <div className="space-y-2">
            <Label>{t("voiceLocale")}</Label>
            <Select
              value={locale}
              onValueChange={(value) => {
                const next = value === "en" ? "en" : "km";
                setLocale(next);
                void save(enabled, next);
              }}
            >
              <SelectTrigger aria-label={t("voiceLocale")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="km">{t("localeKm")}</SelectItem>
                <SelectItem value="en">{t("localeEn")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {saved && <p className="text-sm text-muted-foreground">{t("saved")}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
