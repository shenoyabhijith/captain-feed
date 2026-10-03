import { useReducedMotion } from "motion/react";

/** Calm iOS-like spring for card detail enter/exit. */
export const DETAIL_SPRING = { type: "spring", stiffness: 380, damping: 32 };

/** Dock / panel cross-fade (~180ms). */
export const DOCK_FADE = { duration: 0.18, ease: [0.22, 1, 0.36, 1] };

/** Pressed card scale spring-back. */
export const PRESS_SPRING = { type: "spring", stiffness: 500, damping: 38 };

/** Sleeve full-screen rise from ~24px. */
export const SLEEVE_SPRING = { type: "spring", stiffness: 380, damping: 32 };

export function useMotionOn() {
  return !useReducedMotion();
}

/** Collapse all motion when prefers-reduced-motion (app sets --motion: 0). */
export function motionTransition(enabled, transition) {
  if (!enabled) return { duration: 0 };
  return transition;
}

export function isCardDetailPath(pathname = "") {
  return String(pathname).startsWith("/card/");
}

/**
 * Route enter/exit props for AnimatePresence.
 * Detail: fade + slight rise. Dock panels: opacity cross-fade only.
 */
export function routePresence(pathname, enabled) {
  if (!enabled) {
    return {
      initial: false,
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 1, y: 0 },
      transition: { duration: 0 },
    };
  }
  if (isCardDetailPath(pathname)) {
    return {
      initial: { opacity: 0, y: 14 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 10 },
      transition: DETAIL_SPRING,
    };
  }
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: DOCK_FADE,
  };
}

/** Stable presence key: one slot per dock surface; per-card for detail. */
export function routePresenceKey(pathname = "") {
  if (isCardDetailPath(pathname)) return pathname;
  if (pathname.startsWith("/finances/admin")) return "/finances/admin";
  if (pathname.startsWith("/finances")) return "/finances";
  if (pathname.startsWith("/metrics")) return "/metrics";
  return "/";
}
