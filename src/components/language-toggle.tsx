"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { setLocale } from "@/lib/actions/locale";
import { locales, localeLabels, localeShortLabels, type Locale } from "@/i18n/config";
import { Button } from "@/components/ui/button";

export function LanguageToggle({ current }: { current: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [locale, setLocaleState] = useState(current);

  function toggle() {
    const next = locales[(locales.indexOf(locale) + 1) % locales.length];
    setLocaleState(next);
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      disabled={pending}
      className="gap-1.5"
      aria-label={`${localeLabels.en} / ${localeLabels.km}: ${localeLabels[locale]}`}
    >
      <Languages className="size-4" strokeWidth={1.5} />
      {localeShortLabels[locale]}
    </Button>
  );
}
