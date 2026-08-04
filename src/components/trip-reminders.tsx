"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { getVoiceClips, type ItemVoiceClips } from "@/lib/actions/voice";

interface ReminderItem {
  id: string;
  title: string;
  status: "todo" | "done" | "skipped";
  plannedStart: Date | null;
}

const REMINDER_LEAD_MS = 15 * 60 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;

/**
 * In-app spoken agenda reminders (TC-4): while a trip tab is open, a stop
 * whose planned start is within 15 minutes triggers a toast and — when the
 * user has voice on and a clip exists — the pre-generated "15 minutes
 * until …" audio. Renders nothing; Telegram delivery for a closed app is a
 * planned improvement (needs the cron/job-runner prerequisite).
 */
export function TripReminders({
  tripId,
  dayNumber,
  items,
}: {
  tripId: string;
  dayNumber: number;
  items: ReminderItem[];
}) {
  const tv = useTranslations("voice");
  const [voice, setVoice] = useState<{
    enabled: boolean;
    clips: Record<string, ItemVoiceClips>;
  } | null>(null);
  const firedRef = useRef<Set<string>>(new Set());

  const scheduled = items.filter((i) => i.status === "todo" && i.plannedStart);

  useEffect(() => {
    if (scheduled.length === 0) return;
    let cancelled = false;
    getVoiceClips({ tripId, dayNumber })
      .then((result) => {
        if (!cancelled && result.ok) setVoice(result.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tripId, dayNumber, scheduled.length]);

  useEffect(() => {
    if (scheduled.length === 0) return;

    function check() {
      const now = Date.now();
      for (const item of scheduled) {
        const startMs = item.plannedStart!.getTime();
        const untilStart = startMs - now;
        if (untilStart <= 0 || untilStart > REMINDER_LEAD_MS) continue;
        if (firedRef.current.has(item.id)) continue;
        firedRef.current.add(item.id);

        toast(tv("reminderToast", { place: item.title }));
        const clipUrl = voice?.enabled ? voice.clips[item.id]?.reminderUrl : null;
        if (clipUrl) void new Audio(clipUrl).play().catch(() => {});
      }
    }

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice, scheduled.length]);

  return null;
}
