"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { addItemNote } from "@/lib/actions/item-notes";
import { dollarsToCents } from "@/lib/money/cents";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConvertibleAmountInput } from "@/components/convertible-amount-input";
import { NotebookPen } from "lucide-react";
import { displayForAchievementKey } from "@/lib/trips/achievement-icons";

const TAGS = ["environment", "scenery", "food", "price", "tip"] as const;
const MOODS = ["😞", "😕", "😐", "🙂", "😄"];

export function JournalForm({
  agendaItemId,
  currency,
  usdKhrRate,
}: {
  agendaItemId: string;
  currency: string;
  usdKhrRate: number;
}) {
  const router = useRouter();
  const t = useTranslations("journal");
  const tAchievements = useTranslations("achievements");
  const [mood, setMood] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  // ConvertibleAmountInput manages its own currency-toggle state
  // internally; form.reset() below only touches plain DOM inputs, so
  // bump this to force the amount field to fully remount (and clear)
  // after a successful submit, the same way the rest of the form does.
  const [amountFieldResetKey, setAmountFieldResetKey] = useState(0);

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
    setAmountFieldResetKey((n) => n + 1);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <NotebookPen className="size-4 text-mekong" strokeWidth={1.5} />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label>{t("mood")}</Label>
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
            <Label htmlFor="noteText">{t("notes")}</Label>
            <Textarea id="noteText" name="noteText" rows={3} maxLength={2000} placeholder={t("notesPlaceholder")} />
          </div>
          <div className="space-y-2">
            <Label>{t("tags")}</Label>
            <div className="flex flex-wrap gap-2">
              {TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded-md border px-2.5 py-1 text-xs ${selectedTags.has(tag) ? "border-primary bg-accent" : ""}`}
                  data-testid={`tag-${tag}`}
                >
                  {t(`tagLabels.${tag}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="actualCost">{t("actualCost")}</Label>
            <ConvertibleAmountInput
              key={amountFieldResetKey}
              id="actualCost"
              name="actualCost"
              baseCurrency={currency}
              usdKhrRate={usdKhrRate}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {unlocked.length > 0 && (
            <p className="text-sm text-paddy">
              🏆 {t("achievementUnlocked", {
                keys: unlocked.map((key) => tAchievements(displayForAchievementKey(key).labelKey)).join(", "),
              })}
            </p>
          )}
          <Button type="submit" disabled={submitting} data-testid="submit-journal-entry">
            {submitting ? t("saving") : t("saveEntry")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
