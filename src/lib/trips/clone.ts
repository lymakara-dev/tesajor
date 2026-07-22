export interface CloneableAgendaItem {
  dayNumber: number;
  sortOrder: number;
  title: string;
  category: string;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  plannedCostCents: number | null;
  currency: string;
  placeName: string | null;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole-day offset between two dates, ignoring time-of-day. */
export function dayOffsetBetween(originalStart: Date, newStart: Date): number {
  const originalUtc = Date.UTC(
    originalStart.getFullYear(),
    originalStart.getMonth(),
    originalStart.getDate(),
  );
  const newUtc = Date.UTC(newStart.getFullYear(), newStart.getMonth(), newStart.getDate());
  return Math.round((newUtc - originalUtc) / MS_PER_DAY);
}

export function shiftByDays(date: Date, days: number): Date {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

export interface ClonedTrip {
  newEndDate: Date;
  items: CloneableAgendaItem[];
}

/**
 * Structural clone: shifts every date-bearing field by the same day offset
 * as the trip's start date, keeps everything else (day_number, category,
 * place info) identical, and never touches journals — the caller simply
 * doesn't copy item_notes rows at all.
 */
export function cloneTripStructure(input: {
  originalStartDate: Date;
  originalEndDate: Date;
  newStartDate: Date;
  items: CloneableAgendaItem[];
}): ClonedTrip {
  const offset = dayOffsetBetween(input.originalStartDate, input.newStartDate);

  return {
    newEndDate: shiftByDays(input.originalEndDate, offset),
    items: input.items.map((item) => ({
      ...item,
      plannedStart: item.plannedStart ? shiftByDays(item.plannedStart, offset) : null,
      plannedEnd: item.plannedEnd ? shiftByDays(item.plannedEnd, offset) : null,
    })),
  };
}
