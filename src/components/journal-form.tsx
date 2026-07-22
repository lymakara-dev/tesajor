"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { addItemNote } from "@/lib/actions/item-notes";
import { dollarsToCents } from "@/lib/money/cents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TAGS = ["environment", "scenery", "food", "price", "tip"] as const;
const MOODS = ["😞", "😕", "😐", "🙂", "😄"];

export function JournalForm({ agendaItemId }: { agendaItemId: string }) {
  const router = useRouter();
  const [mood, setMood] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [unlocked, setUnlocked] = useState<string[]>([]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const costInput = String(formData.get("actualCost") ?? "");

    const result = await addItemNote({
      agendaItemId,
      mood: mood ?? undefined,
      noteText: String(formData.get("noteText") ?? "").trim() || undefined,
      tags: [...selectedTags] as ("environment" | "scenery" | "food" | "price" | "tip")[],
      actualCostCents: costInput.trim() ? dollarsToCents(costInput) ?? undefined : undefined,
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setUnlocked(result.data.unlockedAchievements);
    form.reset();
    setMood(null);
    setSelectedTags(new Set());
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Journal this stop</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label>Mood</Label>
            <div className="flex gap-2">
              {MOODS.map((emoji, i) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setMood(i + 1)}
                  className={`rounded-md border px-2 py-1 text-lg ${mood === i + 1 ? "border-primary bg-accent" : ""}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="noteText">Notes</Label>
            <Textarea id="noteText" name="noteText" rows={3} maxLength={2000} placeholder="How was it?" />
          </div>
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded-md border px-2.5 py-1 text-xs capitalize ${selectedTags.has(tag) ? "border-primary bg-accent" : ""}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="actualCost">Actual price paid</Label>
            <Input id="actualCost" name="actualCost" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {unlocked.length > 0 && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              🏆 Achievement unlocked: {unlocked.join(", ")}
            </p>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save journal entry"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
