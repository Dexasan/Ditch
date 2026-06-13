"use client";

import { useEffect, useRef, useState } from "react";

// Fires once when the element first scrolls into view. Used for one-shot
// reveals like the how-it-works signal bus filling in. Stays false on the
// server and until the element is seen, so nothing depends on layout
// measurement during render.
export function useInViewport<T extends Element>(
  options?: IntersectionObserverInit,
) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      options ?? { rootMargin: "0px 0px -15% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}
