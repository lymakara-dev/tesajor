/** Shared micro-interaction timing — 150-200ms ease-out per the Krama motion spec. */
export const MICRO = { duration: 0.18, ease: "easeOut" } as const;

export const TAP_SCALE = { scale: 0.97 };
export const HOVER_LIFT = { scale: 1.01 };

/** Bottom-sheet slide-up (mobile create/edit flows). */
export const SHEET_SLIDE_UP = {
  initial: { y: "100%", opacity: 0.6 },
  animate: { y: 0, opacity: 1 },
  exit: { y: "100%", opacity: 0.6 },
  transition: { duration: 0.2, ease: "easeOut" },
};

/** Card/list-item entrance. */
export const FADE_UP = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: MICRO,
};
