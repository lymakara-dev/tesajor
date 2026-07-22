export type TripRole = "owner" | "editor" | "viewer";

/** Add/edit/reorder agenda items, edit trip settings. */
export function canEditTrip(role: TripRole | undefined): boolean {
  return role === "owner" || role === "editor";
}

/** Mark stops done/skipped — part of "playing" the trip, open to editors too. */
export function canCompleteItems(role: TripRole | undefined): boolean {
  return role === "owner" || role === "editor";
}

/** Any trip member (including viewers) can journal on a stop. */
export function canJournal(role: TripRole | undefined): boolean {
  return role === "owner" || role === "editor" || role === "viewer";
}

/** Publish/unpublish, invite/remove collaborators, delete the trip. */
export function canManageTrip(role: TripRole | undefined): boolean {
  return role === "owner";
}
