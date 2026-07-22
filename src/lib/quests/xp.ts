export const XP_PER_COMPLETION = 10;
export const XP_PER_ACHIEVEMENT = 25;

export interface XpBreakdown {
  totalXp: number;
  fromCompletions: number;
  fromAchievements: number;
}

/**
 * XP is always derived from completed-item and achievement counts —
 * never stored or trusted from the client — so it can't be spoofed and
 * never drifts from the underlying trip state.
 */
export function computeXp(completedItemCount: number, achievementCount: number): XpBreakdown {
  const fromCompletions = completedItemCount * XP_PER_COMPLETION;
  const fromAchievements = achievementCount * XP_PER_ACHIEVEMENT;
  return { totalXp: fromCompletions + fromAchievements, fromCompletions, fromAchievements };
}
