"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { MATERIAL_STANDARD_EASE } from "@/lib/motion";

// Brand colors are fixed regardless of light/dark theme, unlike the rest
// of the app — a logo shouldn't re-tint itself when the user flips a
// setting.
const TILE_BG = "#27357E";
const PIN_COLOR = "#F08A00";
const STROKE_COLOR = "#FCFAF4";

const CURL_PATH =
  "M22 66 C22 56 32 54 33 60 C34 66 26 67 25 61 M25 61 C24 50 40 42 52 48 C64 54 60 68 48 68 C38 68 36 58 46 54 C58 49 70 52 74 42";

// Favicon drops the starting spiral and thickens the stroke/pin so the
// mark reads at very small sizes.
const FAVICON_CURL_PATH =
  "M25 61 C24 50 40 42 52 48 C64 54 60 68 48 68 C38 68 36 58 46 54 C58 49 70 52 74 42";

interface CurlMarkProps {
  path: string;
  strokeWidth: number;
  pinR: number;
  pinDotR: number;
  animate: boolean;
}

function CurlMark({ path, strokeWidth, pinR, pinDotR, animate }: CurlMarkProps) {
  const prefersReducedMotion = useReducedMotion();
  const doAnimate = animate && !prefersReducedMotion;

  if (!doAnimate) {
    return (
      <>
        <path
          d={path}
          fill="none"
          stroke={STROKE_COLOR}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={74} cy={30} r={pinR} fill={PIN_COLOR} />
        <circle cx={74} cy={30} r={pinDotR} fill={STROKE_COLOR} />
      </>
    );
  }

  return (
    <>
      <motion.path
        d={path}
        fill="none"
        stroke={STROKE_COLOR}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, ease: MATERIAL_STANDARD_EASE }}
      />
      <motion.circle
        cx={74}
        cy={30}
        fill={PIN_COLOR}
        initial={{ r: 0 }}
        animate={{ r: pinR }}
        transition={{ delay: 0.45, type: "spring", stiffness: 380, damping: 14 }}
      />
      <motion.circle
        cx={74}
        cy={30}
        fill={STROKE_COLOR}
        initial={{ r: 0 }}
        animate={{ r: pinDotR }}
        transition={{ delay: 0.5, type: "spring", stiffness: 380, damping: 14 }}
      />
    </>
  );
}

function Tile({
  size,
  animate,
  badge,
  className,
}: {
  size: number;
  animate: boolean;
  badge?: boolean;
  className?: string;
}) {
  const tile = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      role="img"
      aria-label="Tesajor"
      className={className}
    >
      <rect width={96} height={96} rx={24} fill={TILE_BG} />
      <CurlMark path={CURL_PATH} strokeWidth={6} pinR={8} pinDotR={3} animate={animate} />
    </svg>
  );

  if (!badge) return tile;

  return (
    <span
      className="krama-pattern inline-flex shrink-0 items-center justify-center rounded-[22%] p-[3px]"
      style={{ width: size * 1.28, height: size * 1.28 }}
    >
      <span className="flex items-center justify-center rounded-[18%] bg-white p-[3px]">
        {tile}
      </span>
    </span>
  );
}

function Lockup({
  size,
  animate,
  className,
}: {
  size: number;
  animate: boolean;
  className?: string;
}) {
  const t = useTranslations("common");
  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <Tile size={size} animate={animate} />
      <div className="flex flex-col leading-tight">
        <span className="font-sans text-lg font-bold text-foreground">Tesajor</span>
        <span className="text-xs text-muted-foreground">{t("tagline")}</span>
      </div>
    </div>
  );
}

export interface LogoProps {
  variant?: "tile" | "lockup" | "favicon" | "badge";
  size?: number;
  /** Draw-in + pin-drop launch animation; off by default. */
  animate?: boolean;
  className?: string;
}

export function Logo({ variant = "tile", size = 40, animate = false, className }: LogoProps) {
  if (variant === "favicon") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 96 96"
        role="img"
        aria-label="Tesajor"
        className={className}
      >
        <rect width={96} height={96} rx={24} fill={TILE_BG} />
        <path
          d={FAVICON_CURL_PATH}
          fill="none"
          stroke={STROKE_COLOR}
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={74} cy={30} r={11} fill={PIN_COLOR} />
        <circle cx={74} cy={30} r={4} fill={STROKE_COLOR} />
      </svg>
    );
  }

  if (variant === "badge") {
    return <Tile size={size} animate={animate} badge className={className} />;
  }

  if (variant === "lockup") {
    return <Lockup size={size} animate={animate} className={className} />;
  }

  return <Tile size={size} animate={animate} className={className} />;
}
