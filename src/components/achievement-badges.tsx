import type { ReactElement } from "react";
import { cn } from "@/lib/utils";

const INK = "#21221D";
const SAFFRON = "#F08A00";
const PADDY = "#1F8A5D";
const MEKONG = "#27357E";

function LotusIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full" role="img" aria-label="Lotus">
      <g fill={PADDY} stroke={INK} strokeWidth="1">
        <path d="M24 40 C18 32 18 22 24 16 C30 22 30 32 24 40 Z" />
        <path d="M24 38 C14 34 8 26 10 18 C18 20 24 28 24 38 Z" opacity="0.9" />
        <path d="M24 38 C34 34 40 26 38 18 C30 20 24 28 24 38 Z" opacity="0.9" />
        <path d="M24 39 C16 39 10 34 8 28 C16 27 22 31 24 39 Z" opacity="0.75" />
        <path d="M24 39 C32 39 38 34 40 28 C32 27 26 31 24 39 Z" opacity="0.75" />
      </g>
      <circle cx="24" cy="38" r="3" fill={SAFFRON} />
    </svg>
  );
}

function BayonFaceIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full" role="img" aria-label="Serene stone face">
      <circle cx="24" cy="24" r="18" fill={MEKONG} />
      <path
        d="M15 20 Q17 17 19 20 M29 20 Q31 17 33 20"
        stroke="#FCFAF4"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M14 29 Q24 37 34 29"
        stroke="#FCFAF4"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M24 21 L22 27 L26 27 Z" fill="#FCFAF4" opacity="0.8" />
    </svg>
  );
}

function TukTukIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full" role="img" aria-label="Tuk-tuk">
      <g stroke={INK} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
        <path d="M10 30 Q10 18 20 18 L30 18 Q36 18 36 26 L36 30" fill={SAFFRON} />
        <rect x="8" y="28" width="30" height="8" rx="2" fill="#FCFAF4" />
        <circle cx="14" cy="38" r="4" fill={INK} />
        <circle cx="32" cy="38" r="4" fill={INK} />
      </g>
      <circle cx="14" cy="38" r="1.6" fill="#FCFAF4" />
      <circle cx="32" cy="38" r="1.6" fill="#FCFAF4" />
    </svg>
  );
}

function NoodleBowlIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full" role="img" aria-label="Noodle bowl">
      <path d="M8 24 Q24 24 40 24 L37 33 Q24 37 11 33 Z" fill="#FCFAF4" stroke={INK} strokeWidth="1.5" />
      <path
        d="M14 25 Q17 29 14 32 M20 25 Q23 29 20 32 M26 25 Q29 29 26 32 M32 25 Q35 29 32 32"
        stroke={SAFFRON}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M18 16 Q16 12 18 8 M24 16 Q22 12 24 8 M30 16 Q28 12 30 8"
        stroke={PADDY}
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
    </svg>
  );
}

export type AchievementIconKey = "lotus" | "bayon-face" | "tuk-tuk" | "noodle-bowl";

const ICONS: Record<AchievementIconKey, () => ReactElement> = {
  lotus: LotusIcon,
  "bayon-face": BayonFaceIcon,
  "tuk-tuk": TukTukIcon,
  "noodle-bowl": NoodleBowlIcon,
};

export interface AchievementBadgeProps {
  icon: AchievementIconKey;
  label: string;
  locked?: boolean;
  size?: number;
  className?: string;
}

/**
 * Achievement badge — icon inside the krama-pattern frame (the 3rd and
 * final sanctioned use of the gingham pattern). `locked` renders the icon
 * grayscale/dimmed for achievements the user hasn't earned yet.
 */
export function AchievementBadge({
  icon,
  label,
  locked = false,
  size = 56,
  className,
}: AchievementBadgeProps) {
  const Icon = ICONS[icon];
  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <span
        className="krama-pattern inline-flex shrink-0 items-center justify-center rounded-2xl p-[3px]"
        style={{ width: size, height: size }}
      >
        <span
          className={cn(
            "flex h-full w-full items-center justify-center rounded-[14px] bg-rice p-2",
            locked && "grayscale opacity-40",
          )}
        >
          <Icon />
        </span>
      </span>
      <span className={cn("text-center text-xs text-muted-foreground", locked && "opacity-60")}>
        {label}
      </span>
    </div>
  );
}
