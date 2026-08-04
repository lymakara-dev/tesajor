/**
 * Reminder timing + URL rules shared by the in-app nudge and the Telegram
 * cron route. Pure, framework-free.
 */

/** How far ahead of a stop's planned start the reminder fires. */
export const REMINDER_LEAD_MS = 15 * 60 * 1000;

/** Due = the planned start is in the future but within the lead window. */
export function isDueForReminder(
  plannedStartMs: number,
  nowMs: number,
  leadMs: number = REMINDER_LEAD_MS,
): boolean {
  const untilStart = plannedStartMs - nowMs;
  return untilStart > 0 && untilStart <= leadMs;
}

/**
 * Telegram needs an absolute URL for audio; locally-stored clips are
 * app-relative (`/uploads/...`). Cloudinary URLs pass through untouched.
 */
export function absoluteAudioUrl(url: string, baseUrl: string): string {
  if (/^https?:\/\//.test(url)) return url;
  return `${baseUrl.replace(/\/+$/, "")}${url.startsWith("/") ? "" : "/"}${url}`;
}
