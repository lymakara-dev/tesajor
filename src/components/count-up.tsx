"use client";

import { useEffect, useRef } from "react";
import { animate, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { motion } from "framer-motion";

/**
 * Animates a numeric value counting up/down to `value` over ~300ms
 * whenever it changes. Falls back to an instant opacity swap under
 * prefers-reduced-motion.
 */
export function CountUp({
  value,
  format,
  className,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
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
      ease: "easeOut",
      onUpdate: (v) => motionValue.set(v),
    });
    previous.current = value;
    return () => controls.stop();
  }, [value, prefersReducedMotion, motionValue]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
