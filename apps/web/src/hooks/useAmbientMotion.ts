"use client";

import { usePageVisible } from "./usePageVisible";
import { useReducedMotion } from "./useReducedMotion";

// Whether ambient, always-on decorative motion should run right now:
// only when the user accepts motion and the tab is in the foreground.
// Scroll-triggered, meaningful motion has its own gating; this is for the
// background, the roaming creatures, and the header heartbeat.
export function useAmbientMotion() {
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  return !reduced && visible;
}
