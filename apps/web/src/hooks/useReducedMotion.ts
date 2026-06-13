"use client";

import { useEffect, useState } from "react";

// True when the user has asked the OS to reduce motion. Defaults to false
// so server render and first paint assume motion is allowed; the effect
// corrects it on mount. Used by every ambient animation on the marketing
// site so there is one source of truth.
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}
