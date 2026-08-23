"use client";

import { useTranslations } from "next-intl";
import { useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Trip-complete celebration + template-share moments only use the Moul
 * display wordmark. The underline here is a solid krama-red bar, not the
 * krama-pattern gingham texture — that texture is reserved for exactly 3
 * places (header ribbon, progress bar fill, achievement badge frame) per
 * spec, and this is deliberately not a 4th.
 */
export function KhmerWordmark({ className }: { className?: string }) {
  return (
    <div className={className}>
      <p className="font-display text-2xl text-foreground">ទេសចរណ៍</p>
      <div className="mt-1.5 h-1 w-16 rounded-full bg-krama" />
    </div>
  );
}

export function TripCompleteCelebration() {
  const t = useTranslations("trip");
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "rounded-xl bg-mekong px-6 py-8 text-center text-rice",
        !prefersReducedMotion && "animate-in fade-in slide-in-from-top-2 duration-300 ease-out",
      )}
    >
      <p className="font-display text-3xl">ទេសចរណ៍</p>
      <div className="mx-auto mt-2 h-1 w-20 rounded-full bg-krama" />
      <p className="mt-3 text-sm text-rice/90">{t("tripComplete")}</p>
    </div>
  );
}
