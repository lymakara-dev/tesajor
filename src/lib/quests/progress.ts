export interface AgendaItemState {
  id: string;
  dayNumber: number;
  status: "todo" | "done" | "skipped";
}

export interface Progress {
  completed: number;
  total: number;
  percent: number;
}

function toProgress(items: AgendaItemState[]): Progress {
  const completed = items.filter((i) => i.status === "done").length;
  const total = items.length;
  return { completed, total, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
}

export function computeDayProgress(items: AgendaItemState[], dayNumber: number): Progress {
  return toProgress(items.filter((i) => i.dayNumber === dayNumber));
}

export function computeTripProgress(items: AgendaItemState[]): Progress {
  return toProgress(items);
}
