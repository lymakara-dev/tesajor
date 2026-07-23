/**
 * Material Design's "standard" easing curve — decelerate-heavy, used for
 * most enter/exit/state-change transitions. https://m2.material.io/design/motion/speed.html#easing
 */
export const MATERIAL_STANDARD_EASE = [0.4, 0, 0.2, 1] as const;

/** Shared micro-interaction timing — 150-200ms per Material's small-animation guidance. */
export const MICRO = { duration: 0.18, ease: MATERIAL_STANDARD_EASE } as const;

export const TAP_SCALE = { scale: 0.97 };
export const HOVER_LIFT = { scale: 1.01 };

/** Bottom-sheet slide-up (mobile create/edit flows). */
export const SHEET_SLIDE_UP = {
  initial: { y: "100%", opacity: 0.6 },
  animate: { y: 0, opacity: 1 },
  exit: { y: "100%", opacity: 0.6 },
  transition: { duration: 0.2, ease: MATERIAL_STANDARD_EASE },
};

/** Card/list-item entrance. */
export const FADE_UP = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: MICRO,
};
