"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { CountUp } from "@/components/count-up";
import { AchievementBadge } from "@/components/achievement-badges";
import { BADGE_GALLERY, displayForAchievementKey } from "@/lib/trips/achievement-icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TripProgressCard({
  completed,
  total,
  percent,
  xpTotal,
  earnedKeys,
}: {
  completed: number;
  total: number;
  percent: number;
  xpTotal: number;
  earnedKeys: string[];
}) {
  const t = useTranslations("trip");
  const prefersReducedMotion = useReducedMotion();
  const earnedIcons = new Set(earnedKeys.map((k) => displayForAchievementKey(k).icon));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("progress")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className="krama-pattern h-full"
              initial={false}
              animate={{ width: `${percent}%` }}
              transition={
                prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 18 }
              }
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("stopsDone", { completed, total })} ·{" "}
            <CountUp value={xpTotal} format={(n) => t("xp", { xp: n })} className="amount" />
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 border-t border-sandstone pt-4">
          {BADGE_GALLERY.map((badge) => (
            <AchievementBadge
              key={badge.icon}
              icon={badge.icon}
              label={badge.label}
              locked={badge.permanentlyLocked || !earnedIcons.has(badge.icon)}
              size={48}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
