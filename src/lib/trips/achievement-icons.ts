import type { AchievementIconKey } from "@/components/achievement-badges";

export interface AchievementDisplay {
  icon: AchievementIconKey;
  /** Key into the "achievements" message namespace — resolve with
   *  useTranslations("achievements")(labelKey), or t("unknown", { key })
   *  for the "unknown" fallback. */
  labelKey: string;
  /** True when no unlock logic exists yet for this badge — always locked. */
  permanentlyLocked?: boolean;
}

/**
 * Maps an achievement key (e.g. "full_day_done:<tripId>:2", "first_trip")
 * to its display badge. Only first_trip/all_stops_done have real unlock
 * logic behind the lotus/Bayon-face art the design spec asked for;
 * tuk-tuk (transport streak) and noodle-bowl (5 food journals) reference
 * unlock rules that don't exist in src/lib/quests/achievements.ts — per
 * "don't change business logic," those two render as permanently-locked
 * decoration rather than gaining new unlock rules.
 */
export function displayForAchievementKey(key: string): AchievementDisplay {
  if (key === "first_trip") return { icon: "lotus", labelKey: "firstTrip" };
  if (key.startsWith("all_stops_done")) return { icon: "bayon-face", labelKey: "allStopsDone" };
  if (key.startsWith("full_day_done")) return { icon: "bayon-face", labelKey: "fullDayDone" };
  if (key.startsWith("day_streak_3")) return { icon: "tuk-tuk", labelKey: "dayStreak3" };
  if (key.startsWith("journaled_every_stop")) return { icon: "noodle-bowl", labelKey: "journaledEveryStop" };
  if (key.startsWith("early_bird")) return { icon: "lotus", labelKey: "earlyBird" };
  return { icon: "lotus", labelKey: "unknown" };
}

/** The full badge gallery shown on a trip page, in a fixed display order. */
export const BADGE_GALLERY: AchievementDisplay[] = [
  { icon: "lotus", labelKey: "firstTrip" },
  { icon: "bayon-face", labelKey: "allStopsDone" },
  { icon: "tuk-tuk", labelKey: "transportExplorer", permanentlyLocked: true },
  { icon: "noodle-bowl", labelKey: "fiveFoodJournals", permanentlyLocked: true },
];
