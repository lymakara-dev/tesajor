"use client";

import { useEffect, useRef } from "react";
import { animate, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { motion } from "framer-motion";
import { MATERIAL_STANDARD_EASE } from "@/lib/motion";

/**
 * Animates a numeric value counting up/down to `value` over ~300ms
 * whenever it changes. Falls back to an instant opacity swap under
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
  const motionValue = useMotionValue(value);
  const rounded = useTransform(motionValue, (v) => format(Math.round(v)));
  const previous = useRef(value);

  useEffect(() => {
    if (prefersReducedMotion) {
      motionValue.set(value);
      previous.current = value;
      return;
    }
    const controls = animate(previous.current, value, {
      duration: 0.3,
      ease: MATERIAL_STANDARD_EASE,
      onUpdate: (v) => motionValue.set(v),
    });
    previous.current = value;
    return () => controls.stop();
  }, [value, prefersReducedMotion, motionValue]);

  return (
    <motion.span className={className} data-testid={testId}>
      {rounded}
    </motion.span>
  );
}
