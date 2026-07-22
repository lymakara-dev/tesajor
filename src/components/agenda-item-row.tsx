"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { completeAgendaItem, resetAgendaItem, skipAgendaItem } from "@/lib/actions/agenda-items";
import { Money } from "@/components/money";
import { ConfettiBurst } from "@/components/confetti-burst";
import { directionsUrl } from "@/lib/trips/geo";
import { displayForAchievementKey } from "@/lib/trips/achievement-icons";
import { Button } from "@/components/ui/button";

export interface AgendaItemRowData {
  id: string;
  tripId: string;
  title: string;
  category: string;
  status: "todo" | "done" | "skipped";
  plannedCostCents: number | null;
  currency: string;
  placeName: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
}

export function AgendaItemRow({
  item,
  canComplete,
}: {
  item: AgendaItemRowData;
  canComplete: boolean;
}) {
  const t = useTranslations("trip");
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [submitting, setSubmitting] = useState(false);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [celebrateTick, setCelebrateTick] = useState(0);
  const [sweep, setSweep] = useState(false);

  async function run(action: typeof completeAgendaItem, celebrate: boolean) {
    setSubmitting(true);
    const result = await action({ itemId: item.id });
    setSubmitting(false);
    if (result.ok) {
      setUnlocked(result.data.unlockedAchievements);
      if (celebrate) {
        setSweep(true);
        setCelebrateTick((n) => n + 1);
        setTimeout(() => setSweep(false), 600);
      }
      router.refresh();
    }
  }

  return (
    <motion.div
      className="relative space-y-1 overflow-visible rounded-md border p-3"
      data-testid={`agenda-item-${item.id}`}
      animate={sweep ? { backgroundColor: "rgba(31,138,93,0.15)" } : { backgroundColor: "rgba(0,0,0,0)" }}
      transition={{ duration: prefersReducedMotion ? 0.15 : 0.6, ease: "easeOut" }}
    >
      <ConfettiBurst trigger={celebrateTick} />
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <AnimatePresence>
            {item.status === "done" && (
              <motion.span
                initial={{ scale: prefersReducedMotion ? 1 : 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0.15 }
                    : { type: "spring", stiffness: 400, damping: 15 }
                }
              >
                <CheckCircle2 className="size-4 shrink-0 text-paddy" strokeWidth={1.5} />
              </motion.span>
            )}
          </AnimatePresence>
          <div className="min-w-0">
            <Link href={`/trips/${item.tripId}/items/${item.id}`} className="truncate font-medium hover:underline">
              {item.title}
            </Link>
            <p className="text-xs text-muted-foreground capitalize" data-testid="agenda-item-meta">
              {item.category}
              {item.plannedCostCents != null && (
                <>
                  {" · "}
                  <Money cents={item.plannedCostCents} currency={item.currency} size="sm" />
                </>
              )}
              {item.placeName && ` · ${item.placeName}`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {(item.address || item.placeName) && (
            <a
              href={directionsUrl(item)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground underline"
            >
              {t("navigate")}
            </a>
          )}
          {canComplete && item.status === "todo" && (
            <>
              <Button size="sm" disabled={submitting} onClick={() => run(completeAgendaItem, true)} data-testid="complete-item">
                {t("done")}
              </Button>
              <Button size="sm" variant="ghost" disabled={submitting} onClick={() => run(skipAgendaItem, false)} data-testid="skip-item">
                {t("skip")}
              </Button>
            </>
          )}
          {canComplete && item.status !== "todo" && (
            <>
              <span className="text-xs text-muted-foreground">
                {item.status === "done" ? t("doneLabel") : t("skippedLabel")}
              </span>
              <Button size="sm" variant="ghost" disabled={submitting} onClick={() => run(resetAgendaItem, false)}>
                {t("undo")}
              </Button>
            </>
          )}
        </div>
      </div>
      {unlocked.length > 0 && (
        <p className="text-xs text-saffron">
          {t("achievementUnlocked", {
            keys: unlocked.map((key) => displayForAchievementKey(key).label).join(", "),
          })}
        </p>
      )}
    </motion.div>
  );
}
