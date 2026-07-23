"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { MATERIAL_STANDARD_EASE } from "@/lib/motion";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeLeft(target: number, now: number): TimeLeft {
  const totalSeconds = Math.max(0, Math.floor((target - now) / 1000));
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  const prefersReducedMotion = useReducedMotion();
  const display = String(value).padStart(2, "0");

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-mekong shadow-sm sm:h-14 sm:w-14">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={display}
            initial={prefersReducedMotion ? false : { y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { y: 16, opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.25, ease: MATERIAL_STANDARD_EASE }}
            className="amount absolute text-lg font-bold text-rice sm:text-xl"
          >
            {display}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

export function TripCountdown({ startDate, endDate }: { startDate: Date; endDate: Date }) {
  const t = useTranslations("trip");
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Render nothing until mounted — Date.now() would otherwise differ
  // between server and client and cause a hydration mismatch.
  if (now === null) return null;

  const startMs = startDate.getTime();
  const endOfTripMs = endDate.getTime() + 86_400_000 - 1;

  if (now > endOfTripMs) return null;

  if (now >= startMs) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-saffron/30 bg-saffron/10 px-4 py-3 text-sm font-semibold text-saffron">
        <Sparkles className="size-4" strokeWidth={1.5} />
        {t("happeningNow")}
      </div>
    );
  }

  const timeLeft = getTimeLeft(startMs, now);

  return (
    <div className="rounded-xl border border-sandstone bg-card p-4">
      <p className="mb-3 text-center text-sm text-muted-foreground">{t("countdownLabel")}</p>
      <div className="flex justify-center gap-2 sm:gap-3">
        <CountdownUnit value={timeLeft.days} label={t("days")} />
        <CountdownUnit value={timeLeft.hours} label={t("hours")} />
        <CountdownUnit value={timeLeft.minutes} label={t("minutes")} />
        <CountdownUnit value={timeLeft.seconds} label={t("seconds")} />
      </div>
    </div>
  );
}
