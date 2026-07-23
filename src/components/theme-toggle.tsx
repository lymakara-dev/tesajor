"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

const OPTIONS = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
] as const;

export function ThemeToggle() {
  const t = useTranslations("theme");
  const { theme, setTheme } = useTheme();
  // Avoid a hydration mismatch: theme is only known client-side.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="inline-flex gap-1 rounded-lg border border-sandstone p-1">
      {OPTIONS.map(({ value, icon: Icon }) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={mounted && theme === value ? "default" : "ghost"}
          onClick={() => setTheme(value)}
          aria-pressed={mounted && theme === value}
          data-testid={`theme-${value}`}
        >
          <Icon className="size-4" strokeWidth={1.5} />
          {t(value)}
        </Button>
      ))}
    </div>
  );
}
