"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { completeAgendaItem, resetAgendaItem, skipAgendaItem } from "@/lib/actions/agenda-items";
import { formatCents } from "@/lib/money/cents";
import { directionsUrl } from "@/lib/trips/geo";
import { Button } from "@/components/ui/button";

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
}: {
  item: AgendaItemRowData;
  canComplete: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [unlocked, setUnlocked] = useState<string[]>([]);

  async function run(action: typeof completeAgendaItem) {
    setSubmitting(true);
    const result = await action({ itemId: item.id });
    setSubmitting(false);
    if (result.ok) {
      setUnlocked(result.data.unlockedAchievements);
      router.refresh();
    }
  }

  return (
    <div className="space-y-1 rounded-md border p-3" data-testid={`agenda-item-${item.id}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/trips/${item.tripId}/items/${item.id}`} className="truncate font-medium hover:underline">
            {item.title}
          </Link>
          <p className="text-xs text-muted-foreground capitalize" data-testid="agenda-item-meta">
            {item.category}
            {item.plannedCostCents != null && ` · ${formatCents(item.plannedCostCents, item.currency)}`}
            {item.placeName && ` · ${item.placeName}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {(item.address || item.placeName) && (
            <a
              href={directionsUrl(item)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground underline"
            >
              Navigate
            </a>
          )}
          {canComplete && item.status === "todo" && (
            <>
              <Button size="sm" disabled={submitting} onClick={() => run(completeAgendaItem)} data-testid="complete-item">
                ✅ Done
              </Button>
              <Button size="sm" variant="ghost" disabled={submitting} onClick={() => run(skipAgendaItem)} data-testid="skip-item">
                Skip
              </Button>
            </>
          )}
          {canComplete && item.status !== "todo" && (
            <>
              <span className="text-xs text-muted-foreground">
                {item.status === "done" ? "Done" : "Skipped"}
              </span>
              <Button size="sm" variant="ghost" disabled={submitting} onClick={() => run(resetAgendaItem)}>
                Undo
              </Button>
            </>
          )}
        </div>
      </div>
      {unlocked.length > 0 && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          🏆 Achievement unlocked: {unlocked.join(", ")}
        </p>
      )}
    </div>
  );
}
