"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/motion";

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animates a numeric value counting up/down to `value` over ~300ms
 * whenever it changes. Falls back to an instant swap under
 * prefers-reduced-motion.
 */
export function CountUp({
  value,
  format,
  className,
  "data-testid": testId,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
  "data-testid"?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayValue(value);
      prevValueRef.current = value;
      return;
    }

    const startVal = prevValueRef.current;
    const endVal = value;
    if (startVal === endVal) {
      setDisplayValue(value);
      return;
    }

    const duration = 300; // ms
    const startTime = performance.now();
    let rafId: number;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);
      const current = Math.round(startVal + (endVal - startVal) * easedProgress);

      setDisplayValue(current);

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        prevValueRef.current = endVal;
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [value, prefersReducedMotion]);

  return (
    <span className={className} data-testid={testId}>
      {format(displayValue)}
    </span>
  );
}
