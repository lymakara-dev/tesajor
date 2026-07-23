"use client";

import { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MATERIAL_STANDARD_EASE } from "@/lib/motion";

const COLORS = ["#D42A34", "#D42A34", "#D42A34", "#F08A00", "#1F8A5D"];
const PARTICLE_COUNT = 16;

interface Particle {
  id: number;
  color: string;
  angle: number;
  distance: number;
  size: number;
  rotate: number;
}

function useParticles(seed: number): Particle[] {
  return useMemo(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      color: COLORS[i % COLORS.length],
      angle: (360 / PARTICLE_COUNT) * i + ((i * 37) % 15),
      distance: 40 + ((i * 13) % 30),
      size: 5 + (i % 3) * 2,
      rotate: (i * 47) % 360,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);
}

/**
 * 600ms krama-colored confetti burst for the quest-completion moment.
 * `trigger` is any value that changes to replay the burst (e.g. an
 * incrementing counter). Renders nothing (and does no work) under
 * prefers-reduced-motion.
 */
export function ConfettiBurst({ trigger }: { trigger: number }) {
  const prefersReducedMotion = useReducedMotion();
  const particles = useParticles(trigger);

  if (prefersReducedMotion || trigger === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      <AnimatePresence>
        <motion.div key={trigger} className="absolute left-1/2 top-1/2">
          {particles.map((p) => {
            const rad = (p.angle * Math.PI) / 180;
            const x = Math.cos(rad) * p.distance;
            const y = Math.sin(rad) * p.distance;
            return (
              <motion.span
                key={p.id}
                className="absolute rounded-sm"
                style={{
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                }}
                initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                animate={{ x, y, opacity: 0, rotate: p.rotate }}
                transition={{ duration: 0.6, ease: MATERIAL_STANDARD_EASE }}
              />
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
