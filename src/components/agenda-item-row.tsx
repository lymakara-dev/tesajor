"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { MATERIAL_STANDARD_EASE } from "@/lib/motion";
import { Check, Navigation } from "lucide-react";
import { completeAgendaItem, resetAgendaItem, skipAgendaItem } from "@/lib/actions/agenda-items";
import { Money } from "@/components/money";
import { ConfettiBurst } from "@/components/confetti-burst";
import { directionsUrl } from "@/lib/trips/geo";
import { displayForAchievementKey } from "@/lib/trips/achievement-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  isNext = false,
}: {
  item: AgendaItemRowData;
  canComplete: boolean;
  /** The nearest upcoming stop across the whole trip — gets the prominent navigate CTA. */
  isNext?: boolean;
}) {
  const t = useTranslations("trip");
  const tAchievements = useTranslations("achievements");
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [submitting, setSubmitting] = useState(false);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [celebrateTick, setCelebrateTick] = useState(0);
  const [sweep, setSweep] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: typeof completeAgendaItem, celebrate: boolean) {
    setSubmitting(true);
    const result = await action({ itemId: item.id });
    setSubmitting(false);
    if (result.ok) {
      setError(null);
      setUnlocked(result.data.unlockedAchievements);
      if (celebrate) {
        setSweep(true);
        setCelebrateTick((n) => n + 1);
        setTimeout(() => setSweep(false), 600);
      }
      router.refresh();
    } else {
      setError(t("updateFailed"));
    }
  }

  const done = item.status === "done";
  const hasPlace = Boolean(item.address || item.placeName);

  return (
    <motion.div
      className={cn(
        "relative space-y-2 overflow-visible rounded-xl border p-3",
        done ? "border-paddy/25 bg-paddy/10" : "border-sandstone",
      )}
      data-testid={`agenda-item-${item.id}`}
      animate={sweep ? { backgroundColor: "rgba(31,138,93,0.15)" } : undefined}
      transition={{ duration: prefersReducedMotion ? 0.15 : 0.6, ease: MATERIAL_STANDARD_EASE }}
    >
      <ConfettiBurst trigger={celebrateTick} />
      <div className="flex items-start gap-3">
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={item.status}
            initial={{ scale: prefersReducedMotion ? 1 : 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={
              prefersReducedMotion ? { duration: 0.15 } : { type: "spring", stiffness: 400, damping: 15 }
            }
            className={cn(
              "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2",
              done
                ? "border-paddy bg-paddy text-rice"
                : item.status === "skipped"
                  ? "border-sandstone bg-sandstone text-muted-foreground"
                  : "border-sandstone",
            )}
          >
            {done && <Check className="size-3.5" strokeWidth={2.5} />}
          </motion.span>
        </AnimatePresence>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <Link
              href={`/trips/${item.tripId}/items/${item.id}`}
              className={cn(
                "truncate font-medium hover:underline",
                done && "text-muted-foreground line-through decoration-[1.5px]",
              )}
            >
              {item.title}
            </Link>
          </div>
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

          {isNext && hasPlace && item.status === "todo" && (
            <a
              href={directionsUrl(item)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-mekong px-3 py-2 text-xs font-semibold text-rice"
            >
              <Navigation className="size-3.5" strokeWidth={2} />
              {t("navigateToNext")}
            </a>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {!isNext && hasPlace && item.status === "todo" && (
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
                <Button size="xs" disabled={submitting} onClick={() => run(completeAgendaItem, true)} data-testid="complete-item">
                  {t("done")}
                </Button>
                <Button size="xs" variant="ghost" disabled={submitting} onClick={() => run(skipAgendaItem, false)} data-testid="skip-item">
                  {t("skip")}
                </Button>
              </>
            )}
            {canComplete && item.status !== "todo" && (
              <>
                <span className="text-xs text-muted-foreground">
                  {item.status === "done" ? t("doneLabel") : t("skippedLabel")}
                </span>
                <Button size="xs" variant="ghost" disabled={submitting} onClick={() => run(resetAgendaItem, false)}>
                  {t("undo")}
                </Button>
              </>
            )}
          </div>

          {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}

          {unlocked.length > 0 && (
            <p className="mt-1.5 text-xs text-saffron" data-testid="achievement-unlocked">
              {t("achievementUnlocked", {
                keys: unlocked.map((key) => tAchievements(displayForAchievementKey(key).labelKey)).join(", "),
              })}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
