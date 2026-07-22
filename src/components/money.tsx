import { formatMoney } from "@/lib/money/cents";
import { cn } from "@/lib/utils";

export type MoneyTone = "owe" | "owed" | "settled" | "neutral";

const TONE_CLASS: Record<MoneyTone, string> = {
  owe: "text-krama",
  owed: "text-paddy",
  settled: "text-mekong",
  neutral: "",
};

export interface MoneyProps {
  cents: number;
  currency: string;
  tone?: MoneyTone;
  /** "stacked": primary large, secondary muted beneath (hero amounts).
   *  "inline": primary with a small muted secondary right after it, both
   *  on one line (list rows, sentences). */
  layout?: "stacked" | "inline";
  size?: "sm" | "base" | "lg" | "xl";
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<MoneyProps["size"]>, string> = {
  sm: "text-sm",
  base: "text-base",
  lg: "text-xl",
  xl: "text-3xl",
};

export function Money({
  cents,
  currency,
  tone = "neutral",
  layout = "inline",
  size = "base",
  className,
}: MoneyProps) {
  const { primary, secondary } = formatMoney(cents, currency);
  const toneClass = TONE_CLASS[tone];

  if (layout === "stacked") {
    return (
      <span className={cn("inline-flex flex-col", className)}>
        <span className={cn("amount", SIZE_CLASS[size], toneClass)}>{primary}</span>
        {secondary && (
          <span className="amount text-xs font-normal text-muted-foreground">
            {secondary}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className={cn("amount", SIZE_CLASS[size], toneClass, className)}>
      {primary}
      {secondary && (
        <span className="amount ml-1 text-xs font-normal text-muted-foreground">
          {secondary}
        </span>
      )}
    </span>
  );
}
