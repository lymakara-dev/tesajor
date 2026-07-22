import type { AchievementIconKey } from "@/components/achievement-badges";

export interface AchievementDisplay {
  icon: AchievementIconKey;
  label: string;
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
  if (key === "first_trip") return { icon: "lotus", label: "First trip" };
  if (key.startsWith("all_stops_done")) return { icon: "bayon-face", label: "All stops done" };
  if (key.startsWith("full_day_done")) return { icon: "bayon-face", label: "Full day done" };
  if (key.startsWith("day_streak_3")) return { icon: "tuk-tuk", label: "3-day streak" };
  if (key.startsWith("journaled_every_stop")) return { icon: "noodle-bowl", label: "Journaled every stop" };
  if (key.startsWith("early_bird")) return { icon: "lotus", label: "Early bird" };
  return { icon: "lotus", label: key };
}

/** The full badge gallery shown on a trip page, in a fixed display order. */
export const BADGE_GALLERY: AchievementDisplay[] = [
  { icon: "lotus", label: "First trip" },
  { icon: "bayon-face", label: "All stops done" },
  { icon: "tuk-tuk", label: "Transport explorer", permanentlyLocked: true },
  { icon: "noodle-bowl", label: "5 food journals", permanentlyLocked: true },
];
