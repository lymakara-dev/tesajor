"use client";

import { useTranslations } from "next-intl";
import { useReducedMotion } from "@/lib/motion";
import { CountUp } from "@/components/count-up";
import { AchievementBadge } from "@/components/achievement-badges";
import { BADGE_GALLERY, displayForAchievementKey } from "@/lib/trips/achievement-icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
  const tAchievements = useTranslations("achievements");
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
            <div
              className={cn(
                "krama-pattern h-full",
                !prefersReducedMotion && "transition-[width] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground" data-testid="stops-done">
            {t("stopsDone", { completed, total })} ·{" "}
            <CountUp value={xpTotal} format={(n) => t("xp", { xp: n })} className="amount" data-testid="xp-total" />
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 border-t border-sandstone pt-4">
          {BADGE_GALLERY.map((badge) => (
            <AchievementBadge
              key={badge.icon}
              icon={badge.icon}
              label={tAchievements(badge.labelKey)}
              locked={badge.permanentlyLocked || !earnedIcons.has(badge.icon)}
              size={48}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
